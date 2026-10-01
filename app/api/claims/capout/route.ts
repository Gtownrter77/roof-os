import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const CAPOUT_API = 'https://api.capout.ai'
const STORAGE_PATH = /^\/storage\/v1\/object\/(?:sign|download|public)\/(inspection-photos|claims-documents)\/([^?]+)$/

function storageSource(sourceUrl: string, workspaceId: string) {
  const parsed = new URL(sourceUrl)
  const configuredOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null
  if (!configuredOrigin || parsed.origin !== configuredOrigin) return false
  const match = parsed.pathname.match(STORAGE_PATH)
  if (!match) return false
  const [firstFolder] = match[2].split('/')
  return firstFolder === workspaceId
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.CAPOUT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CapOut integration is not configured.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { sourceUrl?: string; workspaceId?: string; market?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const workspaceId = body.workspaceId ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  const { data: isAdmin, error: authError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (authError || !isAdmin) return NextResponse.json({ error: 'Workspace administrator authorization is required.' }, { status: 403 })

  let source: URL
  try { source = new URL(body.sourceUrl ?? '') } catch { return NextResponse.json({ error: 'sourceUrl must be a valid application Storage URL.' }, { status: 400 }) }
  if (source.protocol !== 'https:' || source.toString().length > 2048 || !storageSource(source.toString(), workspaceId)) {
    return NextResponse.json({ error: 'sourceUrl must be a signed application Storage asset owned by the authorized workspace.' }, { status: 400 })
  }
  const sourceUrl = source.toString()
  const sourceSha256 = createHash('sha256').update(sourceUrl).digest('hex')
  const { data: existing } = await supabase.from('claims_imports').select('id,status,external_document_id').eq('workspace_id', workspaceId).eq('provider', 'capout').eq('source_sha256', sourceSha256).in('status', ['received','processing','ready_for_review','approved']).maybeSingle()
  if (existing) return NextResponse.json({ provider: 'capout', workspaceId, import: existing, deduplicated: true }, { status: 202 })

  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000)
  let response: Response
  try {
    response = await fetch(`${CAPOUT_API}/upload`, { method: 'POST', headers: { 'content-type': 'application/json', 'capout-api-key': apiKey }, body: JSON.stringify({ url: sourceUrl }), cache: 'no-store', signal: controller.signal })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === 'AbortError' ? 'CapOut upload timed out.' : 'CapOut upload could not be reached.' }, { status: 502 })
  } finally { clearTimeout(timeout) }
  const text = await response.text(); let result: unknown
  try { result = JSON.parse(text) } catch { result = { message: text.slice(0, 500) } }
  if (!response.ok) return NextResponse.json({ error: 'CapOut upload failed.', provider: result }, { status: 502 })
  const providerResult = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  const { data: importRecord, error: importError } = await supabase.from('claims_imports').insert({ workspace_id: workspaceId, provider: 'capout', external_document_id: typeof providerResult.document_id === 'string' ? providerResult.document_id : null, source_uri: sourceUrl, source_sha256: sourceSha256, status: 'processing', market: body.market ?? null, metadata: { providerResult }, created_by: user.id }).select('id,status,external_document_id').single()
  if (importError) return NextResponse.json({ error: 'CapOut accepted the upload, but ROOF/OS could not record the import.', detail: importError.message }, { status: 502 })
  return NextResponse.json({ provider: 'capout', workspaceId, market: body.market ?? null, submittedBy: user.id, import: importRecord, providerResult: result }, { status: 202 })
}
