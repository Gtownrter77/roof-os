import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { fetchWithTimeout, isUuid, parseProviderBody, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

const WORKER_TIMEOUT_MS = 45_000
const MAX_WORKER_RESPONSE_BYTES = 2 * 1024 * 1024

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

function workerUrl() {
  const configured = process.env.CLAIMS_DOCUMENT_WORKER_URL?.trim()
  if (!configured) return null
  try {
    const url = new URL(configured)
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

async function markImportFailed(supabase: Awaited<ReturnType<typeof createClient>>, importId: string, message: string) {
  await supabase.from('claims_imports').update({ status: 'failed', error_message: message.slice(0, 500) }).eq('id', importId)
}

async function boundedText(response: Response) {
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_WORKER_RESPONSE_BYTES) throw new Error('Claims worker response exceeded the allowed size.')
  return text
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parserUrl = workerUrl()
  if (!parserUrl) return NextResponse.json({ error: 'The free local claims parser is not configured.' }, { status: 503 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as RequestBody
  if (!isUuid(body.workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })

  const member = await requireWorkspaceMember(supabase, user.id, body.workspaceId)
  if (member.response) return member.response

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

  if (!body.sourceUrl || body.sourceUrl.length > 2048 || !isAuthorizedStorageUrl(body.sourceUrl)) {
    return NextResponse.json({ error: 'sourceUrl must be a signed URL for an authorized ROOF/OS inspection asset.' }, { status: 400 })
  }

  const sourceSha256 = createHash('sha256').update(body.sourceUrl).digest('hex')
  const externalDocumentId = `local-docling:${sourceSha256}`
  const { data: importRecord, error: importError } = await supabase.from('claims_imports').insert({
    workspace_id: body.workspaceId,
    provider: 'owner_import',
    external_document_id: externalDocumentId,
    source_uri: body.sourceUrl,
    source_sha256: sourceSha256,
    status: 'received',
    market: body.market ?? null,
    metadata: { source: 'signed_inspection_storage_url', parser: 'docling' },
    created_by: user.id,
  }).select('id, workspace_id, status, external_document_id, source_sha256').single()
  if (importError || !importRecord) return NextResponse.json({ error: 'Could not record the local claims import.' }, { status: 502 })

  let response: Response
  try {
    response = await fetchWithTimeout(`${parserUrl}/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sourceUrl: body.sourceUrl, market: body.market ?? null }),
      cache: 'no-store',
    }, WORKER_TIMEOUT_MS)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local claims worker request failed.'
    await markImportFailed(supabase, importRecord.id, message)
    return NextResponse.json({ error: 'The local claims parser could not be reached.', importId: importRecord.id }, { status: 502 })
  }

  let result: unknown
  try { result = parseProviderBody(await boundedText(response)) } catch (error) {
    const message = error instanceof Error ? error.message : 'Local claims parser returned an invalid response.'
    await markImportFailed(supabase, importRecord.id, message)
    return NextResponse.json({ error: message, importId: importRecord.id }, { status: 502 })
  }
  if (!response.ok || !result || typeof result !== 'object') {
    await markImportFailed(supabase, importRecord.id, 'Local claims parser rejected the document.')
    return NextResponse.json({ error: 'Local claims parsing failed.', importId: importRecord.id, parser: result }, { status: 502 })
  }

  const { data: updatedImport, error: updateError } = await supabase.from('claims_imports').update({
    status: 'ready_for_review',
    metadata: { source: 'signed_inspection_storage_url', parser: 'docling', parserResult: result },
  }).eq('id', importRecord.id).select('id, workspace_id, status, external_document_id, source_sha256, metadata').single()
  if (updateError || !updatedImport) return NextResponse.json({ error: 'Parser succeeded, but ROOF/OS could not update the import state.', importId: importRecord.id }, { status: 502 })

  return NextResponse.json({
    provider: 'owner_import',
    parser: 'docling',
    workspaceId: body.workspaceId,
    market: body.market ?? null,
    submittedBy: user.id,
    reviewRequired: true,
    import: updatedImport,
  }, { status: 202 })
}
