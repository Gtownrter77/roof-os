import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { isUuid, readJson } from '../../../lib/api-security'
import { allowedSupplementTransition } from '../../../lib/supplement-workflow'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data, error } = await supabase.from('supplements').select('id,lead_id,job_address,title,description,additional_cost,materials,labor_description,urgency,status,source,evidence,created_at,reviewed_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load supplements.', detail: error.message }, { status: 502 })
  return NextResponse.json({ supplements: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { leadId?: string; jobAddress?: string; title?: string; description?: string; additionalCost?: number; materials?: string[]; laborDescription?: string; urgency?: string; evidence?: Record<string, unknown> }
  const title = body.title?.trim() ?? ''
  const jobAddress = body.jobAddress?.trim() ?? ''
  if (!title || !jobAddress) return NextResponse.json({ error: 'Job address and supplement title are required.' }, { status: 400 })
  const cost = Number(body.additionalCost ?? 0)
  if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ error: 'Additional cost must be a non-negative number.' }, { status: 400 })
  const urgency = body.urgency ?? 'medium'
  if (!['low','medium','high','critical'].includes(urgency)) return NextResponse.json({ error: 'Invalid urgency.' }, { status: 400 })
  if (body.leadId !== undefined && body.leadId !== null && !isUuid(body.leadId)) {
    return NextResponse.json({ error: 'leadId must be a valid UUID.' }, { status: 400 })
  }
  if (body.leadId) {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', body.leadId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (leadError) return NextResponse.json({ error: 'Could not validate lead access.' }, { status: 503 })
    if (!lead) return NextResponse.json({ error: 'leadId must belong to the active workspace.' }, { status: 400 })
  }
  const { data, error } = await supabase.from('supplements').insert({ workspace_id: workspaceId, lead_id: body.leadId ?? null, job_address: jobAddress, title, description: body.description?.trim() ?? '', additional_cost: cost, materials: body.materials ?? [], labor_description: body.laborDescription?.trim() ?? null, urgency, evidence: body.evidence ?? {}, created_by: user.id }).select('id,title,status,additional_cost,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not create supplement.', detail: error.message }, { status: 502 })
  return NextResponse.json({ supplement: data, warning: 'Supplement remains needs_review until an authorized user approves it.' }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError || !isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required for supplement review.' }, { status: 403 })
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { id?: string; status?: string }
  const target = body.status ?? ''
  if (!body.id || !isUuid(body.id) || !['approved', 'rejected', 'needs_review'].includes(target)) return NextResponse.json({ error: 'A valid supplement id and status are required.' }, { status: 400 })
  const { data: existing, error: existingError } = await supabase.from('supplements').select('id,status').eq('id', body.id).eq('workspace_id', workspaceId).maybeSingle()
  if (existingError) return NextResponse.json({ error: 'Could not load the supplement.', detail: existingError.message }, { status: 502 })
  if (!existing) return NextResponse.json({ error: 'Supplement not found.' }, { status: 404 })
  if (!allowedSupplementTransition(existing.status, target)) {
    return NextResponse.json({ error: `A supplement in ${existing.status} cannot be moved to ${target}.` }, { status: 409 })
  }
  // maybeSingle(): a 0-row CAS miss is a lost review race, not a DB error —
  // it must reach the 409 branch below instead of surfacing as a 502 via
  // PostgREST's PGRST116 for .single(). A genuine error still returns 502.
  const { data, error } = await supabase.from('supplements').update({ status: target, reviewed_by: target === 'needs_review' ? null : user.id, reviewed_at: target === 'needs_review' ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.id).eq('workspace_id', workspaceId).eq('status', existing.status).select('id,status,reviewed_at').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not update supplement.', detail: error.message }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'The supplement status changed while this review was in progress.' }, { status: 409 })
  return NextResponse.json({ supplement: data })
}
