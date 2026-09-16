import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

function slopeMultiplier(pitch: number) {
  return Math.sqrt(1 + (pitch / 12) ** 2)
}

type VerifyBody = {
  action?: 'verify' | 'refresh'
  eaveLf?: number
  rafterLf?: number
  pitch?: number
  roofType?: string
  wasteFactor?: number
  soffitWidthFt?: number
  fasciaWidthFt?: number
  notes?: string
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 })
  const workflowId = request.nextUrl.searchParams.get('workflowId')
  if (!workflowId) return NextResponse.json({ error: 'workflowId is required.' }, { status: 400 })

  let body: VerifyBody
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const action = body.action
  if (action !== 'verify' && action !== 'refresh') return NextResponse.json({ error: 'Choose verify or refresh.' }, { status: 400 })

  const { data: workflow, error: fetchError } = await supabase
    .from('photo_estimate_workflows')
    .select('id,workspace_id,report,estimate,status')
    .eq('id', workflowId)
    .eq('workspace_id', workspaceId)
    .single()
  if (fetchError || !workflow) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 })

  const now = new Date().toISOString()
  if (action === 'refresh') {
    const reason = body.notes?.trim() || null
    const report = {
      ...(workflow.report ?? {}),
      photoRefreshRequest: { requestedBy: user.id, requestedAt: now, reason },
      status: 'photo_refresh_requested',
    }
    const { data: updated, error: updateError } = await supabase
      .from('photo_estimate_workflows')
      .update({ status: 'photo_refresh_requested', refresh_requested_by: user.id, refresh_requested_at: now, refresh_reason: reason, report, updated_at: now })
      .eq('id', workflowId)
      .eq('workspace_id', workspaceId)
      .select('id,status,report,refresh_requested_by,refresh_requested_at,refresh_reason,updated_at')
      .single()
    if (updateError) return NextResponse.json({ error: 'Could not record the photo refresh request.', detail: updateError.message }, { status: 502 })
    return NextResponse.json({ workflow: updated, action, warning: 'Photo refresh requested. Existing measurements and source photos were preserved.' })
  }

  // The server checks that a verification payload is present and numeric enough
  // to persist. It does not decide whether the technician measurements are
  // plausible; that decision belongs to the technician using this button.
  const eaveLf = Number(body.eaveLf)
  const rafterLf = Number(body.rafterLf)
  const pitch = Number(body.pitch)
  const wasteFactor = Number(body.wasteFactor)
  const soffitWidthFt = Number(body.soffitWidthFt)
  const fasciaWidthFt = Number(body.fasciaWidthFt)
  if (![eaveLf, rafterLf, pitch, wasteFactor, soffitWidthFt, fasciaWidthFt].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Enter the technician measurements before verifying.' }, { status: 400 })
  }

  const multiplier = slopeMultiplier(pitch)
  const fieldAreaSqFt = eaveLf * rafterLf * multiplier
  const fieldSquares = fieldAreaSqFt / 100 * (1 + wasteFactor)
  const verification = { verifiedBy: user.id, verifiedAt: now, eaveLf, rafterLf, pitch, slopeMultiplier: Number(multiplier.toFixed(4)), roofType: body.roofType ?? 'other', wasteFactor, soffitWidthFt, soffitLf: eaveLf, fasciaWidthFt, fasciaLf: eaveLf, fieldAreaSqFt: Number(fieldAreaSqFt.toFixed(2)), fieldSquares: Number(fieldSquares.toFixed(2)), notes: body.notes?.trim() || null, decision: 'verified_by_technician' }
  const report = { ...(workflow.report ?? {}), technicianVerification: verification, status: 'approved_for_customer_packet' }
  const { data: updated, error: updateError } = await supabase
    .from('photo_estimate_workflows')
    .update({ status: 'approved', roof_squares: fieldSquares, soffit_width_ft: soffitWidthFt, soffit_lf: eaveLf, fascia_width_ft: fasciaWidthFt, fascia_lf: eaveLf, report, approved_by: user.id, approved_at: now, updated_at: now })
    .eq('id', workflowId)
    .eq('workspace_id', workspaceId)
    .select('id,status,roof_squares,soffit_width_ft,soffit_lf,fascia_width_ft,fascia_lf,report,approved_by,approved_at,updated_at')
    .single()
  if (updateError) return NextResponse.json({ error: 'Could not save technician verification.', detail: updateError.message }, { status: 502 })
  return NextResponse.json({ workflow: updated, verification, action, warning: 'Technician verification recorded. Customer email and digital signature remain separate controlled steps.' })
}
