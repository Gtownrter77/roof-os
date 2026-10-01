import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data, error } = await supabase.from('supplements').select('id,lead_id,job_address,title,description,additional_cost,materials,labor_description,urgency,status,source,evidence,created_at,reviewed_at,reviewed_by').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load supplements.', detail: error.message }, { status: 502 })
  return NextResponse.json({ supplements: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  let body: { leadId?: string; jobAddress?: string; title?: string; description?: string; additionalCost?: number; materials?: string[]; laborDescription?: string; urgency?: string; evidence?: Record<string, unknown> }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const title = body.title?.trim() ?? ''; const jobAddress = body.jobAddress?.trim() ?? ''; const cost = Number(body.additionalCost ?? 0); const urgency = body.urgency ?? 'medium'
  if (!title || !jobAddress) return NextResponse.json({ error: 'Job address and supplement title are required.' }, { status: 400 })
  if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ error: 'Additional cost must be a non-negative number.' }, { status: 400 })
  if (!['low','medium','high','critical'].includes(urgency)) return NextResponse.json({ error: 'Invalid urgency.' }, { status: 400 })
  const { data, error } = await supabase.from('supplements').insert({ workspace_id: workspaceId, lead_id: body.leadId ?? null, job_address: jobAddress, title, description: body.description?.trim() ?? '', additional_cost: cost, materials: body.materials ?? [], labor_description: body.laborDescription?.trim() ?? null, urgency, evidence: body.evidence ?? {}, created_by: user.id }).select('id,title,status,additional_cost,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not create supplement.', detail: error.message }, { status: 502 })
  return NextResponse.json({ supplement: data, warning: 'Supplement remains needs_review until an authorized workspace admin approves it.' }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin, error: authError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (authError || !isAdmin) return NextResponse.json({ error: 'Only a workspace owner or admin may review supplements.' }, { status: 403 })
  let body: { id?: string; status?: 'approved' | 'rejected' | 'needs_review' }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  if (!body.id || !body.status) return NextResponse.json({ error: 'A valid supplement id and status are required.' }, { status: 400 })
  const { data: current, error: readError } = await supabase.from('supplements').select('id,status').eq('id', body.id).eq('workspace_id', workspaceId).maybeSingle()
  if (readError) return NextResponse.json({ error: 'Could not load supplement.', detail: readError.message }, { status: 502 })
  if (!current) return NextResponse.json({ error: 'Supplement not found in the active workspace.' }, { status: 404 })
  if (body.status === 'needs_review' && current.status !== 'needs_review') return NextResponse.json({ error: 'Approved or rejected supplements cannot be silently reopened; create a new review record.' }, { status: 409 })
  if (current.status !== 'needs_review') return NextResponse.json({ error: 'Only supplements in needs_review may be approved or rejected.' }, { status: 409 })
  const reviewedAt = new Date().toISOString()
  const { data, error } = await supabase.from('supplements').update({ status: body.status, reviewed_by: body.status === 'needs_review' ? null : user.id, reviewed_at: body.status === 'needs_review' ? null : reviewedAt, updated_at: reviewedAt }).eq('id', body.id).eq('workspace_id', workspaceId).eq('status', 'needs_review').select('id,status,reviewed_at,reviewed_by').single()
  if (error) return NextResponse.json({ error: 'Could not update supplement.', detail: error.message }, { status: 502 })
  return NextResponse.json({ supplement: data })
}
