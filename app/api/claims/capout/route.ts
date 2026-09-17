import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { fetchWithTimeout, isUuid, parseProviderBody, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

const CAPOUT_API = 'https://api.capout.ai'
const CAPOUT_TIMEOUT_MS = 15_000

type RequestBody = { sourceUrl?: string; workspaceId?: string; market?: string }

function isAuthorizedStorageUrl(sourceUrl: string) {
  try {
    const { url: supabaseUrl } = getSupabaseEnv()
    const expected = new URL(supabaseUrl)
    const source = new URL(sourceUrl)
    return source.protocol === 'https:'
      && source.origin === expected.origin
      && source.pathname.startsWith('/storage/v1/object/sign/inspection-photos/')
      && source.searchParams.has('token')
  } catch {
    return false
  }
}

async function markImportFailed(supabase: Awaited<ReturnType<typeof createClient>>, importId: string, message: string) {
  await supabase.from('claims_imports').update({ status: 'failed', error_message: message.slice(0, 500) }).eq('id', importId)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const apiKey = process.env.CAPOUT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CapOut integration is not configured.' }, { status: 503 })

  const parsed = await readJson(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.body as RequestBody
  if (!isUuid(body.workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  const member = await requireWorkspaceMember(supabase, user.id, body.workspaceId)
  if (member.response) return member.response
  if (!body.sourceUrl || body.sourceUrl.length > 2048 || !isAuthorizedStorageUrl(body.sourceUrl)) {
    return NextResponse.json({ error: 'sourceUrl must be a signed URL for an authorized ROOF/OS inspection asset.' }, { status: 400 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', body.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError) return NextResponse.json({ error: 'Could not verify workspace access.' }, { status: 502 })
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Workspace administrator access is required.' }, { status: 403 })
  }

  const sourceSha256 = createHash('sha256').update(body.sourceUrl).digest('hex')
  const { data: importRecord, error: importError } = await supabase.from('claims_imports').insert({
    workspace_id: body.workspaceId,
    provider: 'capout',
    source_uri: body.sourceUrl,
    source_sha256: sourceSha256,
    status: 'received',
    market: body.market ?? null,
    metadata: { source: 'signed_inspection_storage_url' },
    created_by: user.id,
  }).select('id, workspace_id, status, source_sha256').single()
  if (importError || !importRecord) return NextResponse.json({ error: 'Could not record the authorized claims import.' }, { status: 502 })

  let response: Response
  try {
    response = await fetchWithTimeout(`${CAPOUT_API}/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'capout-api-key': apiKey },
      body: JSON.stringify({ url: body.sourceUrl }),
      cache: 'no-store',
    }, CAPOUT_TIMEOUT_MS)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider request failed.'
    await markImportFailed(supabase, importRecord.id, message)
    return NextResponse.json({ error: 'CapOut upload could not be reached.', importId: importRecord.id }, { status: 502 })
  }

  const result = parseProviderBody(await response.text())
  if (!response.ok) {
    await markImportFailed(supabase, importRecord.id, 'CapOut rejected the upload.')
    return NextResponse.json({ error: 'CapOut upload failed.', importId: importRecord.id, provider: result }, { status: 502 })
  }

  const providerResult = (result && typeof result === 'object') ? result as Record<string, unknown> : {}
  const { data: updatedImport, error: updateError } = await supabase.from('claims_imports').update({
    status: 'processing',
    external_document_id: typeof providerResult.document_id === 'string' ? providerResult.document_id : null,
    metadata: { source: 'signed_inspection_storage_url', providerResult },
  }).eq('id', importRecord.id).select('id, workspace_id, status, external_document_id, source_sha256').single()
  if (updateError || !updatedImport) return NextResponse.json({ error: 'CapOut accepted the upload, but ROOF/OS could not update the import state.', importId: importRecord.id }, { status: 502 })

  return NextResponse.json({ provider: 'capout', workspaceId: body.workspaceId, market: body.market ?? null, submittedBy: user.id, import: updatedImport, providerResult: result }, { status: 202 })
}
