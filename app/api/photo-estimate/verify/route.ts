import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { calculateRoofSquares } from '../../../../lib/estimates/verified-photo-workflow.mjs'

type VerifyBody = {
  action?: 'verify' | 'refresh'
  technicianName?: string
  technicianLicense?: string
  technicianSignature?: string
  eaveLf?: number
  rafterLf?: number
  pitch?: number
  roofType?: string
  wasteFactor?: number
  soffitWidthFt?: number
  fasciaWidthFt?: number
  gutterLf?: number
  notes?: string
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 })
  const workflowId = request.nextUrl.searchParams.get('workflowId')
  if (!isUuid(workflowId)) return NextResponse.json({ error: 'A valid workflowId is required.' }, { status: 400 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as VerifyBody
  const action = body.action
  if (action !== 'verify' && action !== 'refresh') return NextResponse.json({ error: 'Choose verify or refresh.' }, { status: 400 })
  if ((body.notes?.length ?? 0) > 5_000 || (body.roofType?.length ?? 0) > 80) return NextResponse.json({ error: 'Notes or roof type exceeds the supported text length.' }, { status: 400 })
  if (action === 'verify') {
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
    if (roleError || !isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required for estimate approval.' }, { status: 403 })
    if ((body.technicianName?.length ?? 0) > 160 || (body.technicianLicense?.length ?? 0) > 120 || (body.technicianSignature?.length ?? 0) > 240_032) return NextResponse.json({ error: 'Technician review metadata exceeds the supported size.' }, { status: 400 })
    if (body.technicianSignature && !/^data:image\/png;base64,[A-Za-z0-9+/=]{1,240000}$/.test(body.technicianSignature.trim())) return NextResponse.json({ error: 'Technician signature must be a PNG capture.' }, { status: 400 })
  }

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
  if (typeof body.gutterLf !== 'number' || !Number.isFinite(body.gutterLf)) {
    return NextResponse.json({ error: 'Enter the technician-measured gutter length, or enter 0 if there are no gutters.' }, { status: 400 })
  }
  const gutterLf = body.gutterLf
  if (![eaveLf, rafterLf, pitch, wasteFactor, soffitWidthFt, fasciaWidthFt, gutterLf].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Enter the technician roof and gutter measurements before verifying.' }, { status: 400 })
  }
  if (eaveLf <= 0 || eaveLf > 10000 || rafterLf <= 0 || rafterLf > 10000 || pitch < 0 || pitch > 24 || wasteFactor < 0 || wasteFactor > 1 || soffitWidthFt < 0 || soffitWidthFt > 20 || fasciaWidthFt < 0 || fasciaWidthFt > 20 || gutterLf < 0 || gutterLf > 10000) {
    return NextResponse.json({ error: 'Measurement values are outside supported safety limits.' }, { status: 400 })
  }

  const { slopeMultiplier, fieldAreaSqFt, fieldSquares } = calculateRoofSquares({ eaveLf, rafterLf, pitch, wasteFactor })
  if (!Number.isFinite(fieldSquares) || fieldSquares <= 0 || fieldSquares > 100_000) {
    return NextResponse.json({ error: 'The derived roof quantity is outside supported safety limits.' }, { status: 400 })
  }
  const verifiedGutterLf = Number(gutterLf.toFixed(2))
  const technicianName = body.technicianName?.trim() ?? ''
  const technicianLicense = body.technicianLicense?.trim() ?? ''
  const technicianSignature = body.technicianSignature?.trim() ?? ''
  const verification = {
    verifiedBy: user.id,
    verifiedAt: now,
    ...(technicianName ? { technicianName } : {}),
    ...(technicianLicense ? { technicianLicense } : {}),
    ...(technicianSignature ? { technicianSignature } : {}),
    eaveLf,
    rafterLf,
    pitch,
    slopeMultiplier,
    roofType: body.roofType ?? 'other',
    wasteFactor,
    soffitWidthFt,
    soffitLf: eaveLf,
    fasciaWidthFt,
    fasciaLf: eaveLf,
    gutterLf: verifiedGutterLf,
    fieldAreaSqFt,
    fieldSquares,
    notes: body.notes?.trim() || null,
    decision: 'verified_by_technician',
  }
  const report = { ...(workflow.report ?? {}), technicianVerification: verification, status: 'approved_for_customer_packet' }
  const { data: updated, error: updateError } = await supabase
    .from('photo_estimate_workflows')
    .update({ status: 'approved', roof_squares: fieldSquares, gutter_lf: verifiedGutterLf, soffit_width_ft: soffitWidthFt, soffit_lf: eaveLf, fascia_width_ft: fasciaWidthFt, fascia_lf: eaveLf, report, approved_by: user.id, approved_at: now, ...(technicianName ? { technician_name: technicianName } : {}), ...(technicianLicense ? { technician_license: technicianLicense } : {}), ...(technicianSignature ? { technician_signature: technicianSignature } : {}), updated_at: now })
    .eq('id', workflowId)
    .eq('workspace_id', workspaceId)
    .select('id,status,roof_squares,gutter_lf,soffit_width_ft,soffit_lf,fascia_width_ft,fascia_lf,report,approved_by,approved_at,updated_at')
    .single()
  if (updateError) return NextResponse.json({ error: 'Could not save technician verification.', detail: updateError.message }, { status: 502 })
  return NextResponse.json({ workflow: updated, verification, action, warning: 'Technician verification recorded. Manager approval and photo review remain separate controlled steps.' })
}
