import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { fetchWithTimeout, isUuid, parseProviderBody, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { isContentSha256, isRetryableImportStatus, sourceUriFingerprint, stableExternalDocumentId } from '../../../../lib/claims/provenance'

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
  // Only a fresh 'received' row may fail. Never overwrite a terminal state.
  await supabase.from('claims_imports')
    .update({ status: 'failed', error_message: message.slice(0, 500) })
    .eq('id', importId)
    .eq('status', 'received')
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

  const sourceUriSha256 = sourceUriFingerprint(body.sourceUrl)
  const externalDocumentId = stableExternalDocumentId('owner_import', body.sourceUrl)
  if (!externalDocumentId) return NextResponse.json({ error: 'sourceUrl must identify an inspection storage asset.' }, { status: 400 })

  // source_sha256 is a CONTENT hash. It is filled from the worker's byte hash
  // after parsing; the signed-URI fingerprint stays in metadata.
  const importMetadata = { source: 'signed_inspection_storage_url', parser: 'docling', sourceUriSha256 }
  const { data: existingImport, error: lookupError } = await supabase
    .from('claims_imports')
    .select('id, status')
    .eq('workspace_id', body.workspaceId)
    .eq('provider', 'owner_import')
    .eq('external_document_id', externalDocumentId)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'Could not check the claims import state.' }, { status: 502 })

  let importId: string
  if (existingImport && !isRetryableImportStatus(existingImport.status)) {
    return NextResponse.json({ error: 'This document was already imported for the workspace.', importId: existingImport.id }, { status: 409 })
  }
  if (existingImport) {
    // A transient worker/network failure leaves a 'failed' row with this same
    // stable key. Reset it so the document can be retried; never touch a row
    // already in a terminal state.
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
      provider: 'owner_import',
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
    if (importError || !inserted) return NextResponse.json({ error: 'Could not record the local claims import.' }, { status: 502 })
    importId = inserted.id
  }

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
    await markImportFailed(supabase, importId, message)
    return NextResponse.json({ error: 'The local claims parser could not be reached.', importId: importId }, { status: 502 })
  }

  let result: unknown
  try { result = parseProviderBody(await boundedText(response)) } catch (error) {
    const message = error instanceof Error ? error.message : 'Local claims parser returned an invalid response.'
    await markImportFailed(supabase, importId, message)
    return NextResponse.json({ error: message, importId: importId }, { status: 502 })
  }
  if (!response.ok || !result || typeof result !== 'object') {
    await markImportFailed(supabase, importId, 'Local claims parser rejected the document.')
    return NextResponse.json({ error: 'Local claims parsing failed.', importId: importId, parser: result }, { status: 502 })
  }

  const contentSha256 = isContentSha256((result as Record<string, unknown>).sourceSha256)
    ? (result as Record<string, unknown>).sourceSha256 as string
    : null
  const { data: updatedImport, error: updateError } = await supabase.from('claims_imports').update({
    status: 'ready_for_review',
    source_sha256: contentSha256,
    metadata: { source: 'signed_inspection_storage_url', parser: 'docling', sourceUriSha256, parserResult: result },
  }).eq('id', importId).eq('status', 'received').select('id, workspace_id, status, external_document_id, source_sha256, metadata').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'Parser succeeded, but ROOF/OS could not update the import state.', importId: importId }, { status: 502 })
  if (!updatedImport) return NextResponse.json({ error: 'Import state changed concurrently.', importId: importId }, { status: 409 })

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
