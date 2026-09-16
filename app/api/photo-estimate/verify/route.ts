import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

function slopeMultiplier(pitch: number) {
  return Math.sqrt(1 + (pitch / 12) ** 2)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 })
  const workflowId = request.nextUrl.searchParams.get('workflowId')
  if (!workflowId) return NextResponse.json({ error: 'workflowId is required.' }, { status: 400 })
  let body: { eaveLf?: number; rafterLf?: number; pitch?: number; roofType?: 'hip' | 'gable' | 'other'; wasteFactor?: number; soffitWidthFt?: number; fasciaWidthFt?: number; notes?: string; approved?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const eaveLf = Number(body.eaveLf); const rafterLf = Number(body.rafterLf); const pitch = Number(body.pitch); const wasteFactor = Number(body.wasteFactor); const soffitWidthFt = Number(body.soffitWidthFt); const fasciaWidthFt = Number(body.fasciaWidthFt)
  if (![eaveLf, rafterLf, pitch, wasteFactor, soffitWidthFt, fasciaWidthFt].every(Number.isFinite) || eaveLf <= 0 || rafterLf <= 0 || pitch <= 0 || soffitWidthFt <= 0 || fasciaWidthFt <= 0 || wasteFactor < 0 || wasteFactor > 1) return NextResponse.json({ error: 'Enter positive eave, rafter, pitch, soffit width, fascia width, and a waste factor from 0 to 1.' }, { status: 400 })
  if (!body.roofType) return NextResponse.json({ error: 'Roof type is required.' }, { status: 400 })

  const { data: workflow, error: fetchError } = await supabase.from('photo_estimate_workflows').select('id,workspace_id,report,estimate,status').eq('id', workflowId).eq('workspace_id', workspaceId).single()
  if (fetchError || !workflow) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 })
  const multiplier = slopeMultiplier(pitch)
  const fieldAreaSqFt = eaveLf * rafterLf * multiplier
  const fieldSquares = fieldAreaSqFt / 100 * (1 + wasteFactor)
  const verification = { verifiedBy: user.id, verifiedAt: new Date().toISOString(), eaveLf, rafterLf, pitch, slopeMultiplier: Number(multiplier.toFixed(4)), roofType: body.roofType, wasteFactor, soffitWidthFt, soffitLf: eaveLf, fasciaWidthFt, fasciaLf: eaveLf, fieldAreaSqFt: Number(fieldAreaSqFt.toFixed(2)), fieldSquares: Number(fieldSquares.toFixed(2)), notes: body.notes?.trim() || null, approved: Boolean(body.approved) }
  const report = { ...(workflow.report ?? {}), technicianVerification: verification, status: verification.approved ? 'approved_for_customer_packet' : 'needs_review' }
  const nextStatus = verification.approved ? 'approved' : 'measurement_review'
  const { data: updated, error: updateError } = await supabase.from('photo_estimate_workflows').update({ status: nextStatus, roof_squares: fieldSquares, soffit_width_ft: soffitWidthFt, soffit_lf: eaveLf, fascia_width_ft: fasciaWidthFt, fascia_lf: eaveLf, report, updated_at: new Date().toISOString(), ...(verification.approved ? { approved_by: user.id, approved_at: new Date().toISOString() } : {}) }).eq('id', workflowId).eq('workspace_id', workspaceId).select('id,status,roof_squares,soffit_width_ft,soffit_lf,fascia_width_ft,fascia_lf,report,updated_at').single()
  if (updateError) return NextResponse.json({ error: 'Could not save field verification.', detail: updateError.message }, { status: 502 })
  return NextResponse.json({ workflow: updated, verification, warning: verification.approved ? 'Approved for customer packet creation. Email and signature remain separate controlled steps.' : 'Field measurements saved; technician approval is still required.' })
}
