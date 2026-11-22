import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { fetchWithTimeout, isUuid, parseProviderBody, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { isContentSha256, isRetryableImportStatus, sourceUriFingerprint, stableExternalDocumentId } from '../../../../lib/claims/provenance'

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
  // Only a fresh 'received' row may fail. Never overwrite a terminal state.
  await supabase.from('claims_imports')
    .update({ status: 'failed', error_message: message.slice(0, 500) })
    .eq('id', importId)
    .eq('status', 'received')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const apiKey = process.env.CAPOUT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CapOut integration is not configured.' }, { status: 503 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as RequestBody
  if (!isUuid(body.workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })

  const member = await requireWorkspaceMember(supabase, user.id, body.workspaceId)
  if (member.response) return member.response

  // Workspace administrative role verification
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

  const sourceUriSha256 = sourceUriFingerprint(body.sourceUrl)
  const externalDocumentId = stableExternalDocumentId('capout', body.sourceUrl)
  if (!externalDocumentId) return NextResponse.json({ error: 'sourceUrl must identify an inspection storage asset.' }, { status: 400 })

  // source_sha256 is a CONTENT hash and stays null until a provider reports
  // one. The signed-URI fingerprint is recorded under its honest name.
  const importMetadata = { source: 'signed_inspection_storage_url', sourceUriSha256 }
  const { data: existingImport, error: lookupError } = await supabase
    .from('claims_imports')
    .select('id, status')
    .eq('workspace_id', body.workspaceId)
    .eq('provider', 'capout')
    .eq('external_document_id', externalDocumentId)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'Could not check the claims import state.' }, { status: 502 })

  let importId: string
  if (existingImport && !isRetryableImportStatus(existingImport.status)) {
    return NextResponse.json({ error: 'This document was already imported for the workspace.', importId: existingImport.id }, { status: 409 })
  }
  if (existingImport) {
    // Reset a failed/unfinished row instead of burning the stable key. The
    // status predicate prevents overwriting a row another admin just advanced.
    const { data: reused, error: reuseError } = await supabase.from('claims_imports').update({
      status: 'received',
      source_uri: body.sourceUrl,
      source_sha256: null,
      error_message: null,
      market: body.market ?? null,
      metadata: importMetadata,
      updated_at: new Date().toISOString(),
    }).eq('id', existingImport.id).eq('status', existingImport.status).select('id').maybeSingle()
    if (reuseError) return NextResponse.json({ error: 'Could not reset the failed claims import.' }, { status: 502 })
    if (!reused) return NextResponse.json({ error: 'Import state changed concurrently.', importId: existingImport.id }, { status: 409 })
    importId = reused.id
  } else {
    const { data: inserted, error: importError } = await supabase.from('claims_imports').insert({
      workspace_id: body.workspaceId,
      provider: 'capout',
      external_document_id: externalDocumentId,
      source_uri: body.sourceUrl,
      source_sha256: null,
      status: 'received',
      market: body.market ?? null,
      metadata: importMetadata,
      created_by: user.id,
    }).select('id').single()
    if (importError?.code === '23505') {
      return NextResponse.json({ error: 'This document is being imported concurrently; retry shortly.', importId: null }, { status: 409 })
    }
    if (importError || !inserted) return NextResponse.json({ error: 'Could not record the authorized claims import.' }, { status: 502 })
    importId = inserted.id
  }

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
    await markImportFailed(supabase, importId, message)
    return NextResponse.json({ error: 'CapOut upload could not be reached.', importId: importId }, { status: 502 })
  }

  const result = parseProviderBody(await response.text())
  if (!response.ok) {
    await markImportFailed(supabase, importId, 'CapOut rejected the upload.')
    return NextResponse.json({ error: 'CapOut upload failed.', importId: importId, provider: result }, { status: 502 })
  }

  const providerResult = (result && typeof result === 'object') ? result as Record<string, unknown> : {}
  const providerContentSha256 = isContentSha256(providerResult.source_sha256)
    ? providerResult.source_sha256
    : (isContentSha256(providerResult.sha256) ? providerResult.sha256 : null)
  const { data: updatedImport, error: updateError } = await supabase.from('claims_imports').update({
    status: 'processing',
    source_sha256: providerContentSha256,
    metadata: {
      source: 'signed_inspection_storage_url',
      sourceUriSha256,
      providerDocumentId: typeof providerResult.document_id === 'string' ? providerResult.document_id : null,
      providerResult,
    },
  }).eq('id', importId).eq('status', 'received').select('id, workspace_id, status, external_document_id, source_sha256').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'CapOut accepted the upload, but ROOF/OS could not update the import state.', importId: importId }, { status: 502 })
  if (!updatedImport) return NextResponse.json({ error: 'Import state changed concurrently.', importId: importId }, { status: 409 })

  return NextResponse.json({ provider: 'capout', workspaceId: body.workspaceId, market: body.market ?? null, submittedBy: user.id, import: updatedImport, providerResult: result }, { status: 202 })
}
