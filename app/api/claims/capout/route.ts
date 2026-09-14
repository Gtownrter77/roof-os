import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const CAPOUT_API = 'https://api.capout.ai'

export async function POST(request: NextRequest) {
  const apiKey = process.env.CAPOUT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CapOut integration is not configured.' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { sourceUrl?: string; workspaceId?: string; market?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  if (!body.workspaceId || !/^[0-9a-f-]{36}$/i.test(body.workspaceId)) {
    return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  }
  if (!body.sourceUrl || !/^https:\/\//i.test(body.sourceUrl)) {
    return NextResponse.json({ error: 'sourceUrl must be an HTTPS URL.' }, { status: 400 })
  }
  if (body.sourceUrl.length > 2048) return NextResponse.json({ error: 'sourceUrl is too long.' }, { status: 400 })

  const response = await fetch(`${CAPOUT_API}/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'capout-api-key': apiKey },
    body: JSON.stringify({ url: body.sourceUrl }),
    cache: 'no-store',
  })
  const text = await response.text()
  let result: unknown
  try { result = JSON.parse(text) } catch { result = { message: text.slice(0, 500) } }
  if (!response.ok) return NextResponse.json({ error: 'CapOut upload failed.', provider: result }, { status: 502 })

  const providerResult = (result && typeof result === 'object') ? result as Record<string, unknown> : {}
  const { data: importRecord, error: importError } = await supabase.from('claims_imports').insert({
    workspace_id: body.workspaceId,
    provider: 'capout',
    external_document_id: typeof providerResult.document_id === 'string' ? providerResult.document_id : null,
    source_uri: body.sourceUrl,
    status: 'processing',
    market: body.market ?? null,
    metadata: { providerResult },
    created_by: user.id,
  }).select('id, status, external_document_id').single()
  if (importError) return NextResponse.json({ error: 'CapOut accepted the upload, but ROOF/OS could not record the import.', detail: importError.message }, { status: 502 })

  return NextResponse.json({
    provider: 'capout',
    workspaceId: body.workspaceId,
    market: body.market ?? null,
    submittedBy: user.id,
    import: importRecord,
    providerResult: result,
  }, { status: 202 })
}
