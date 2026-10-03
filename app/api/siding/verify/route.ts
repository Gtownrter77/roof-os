import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { calculateSidingMeasurement } from '../../../../lib/siding/measurement'

type VerifyBody = {
  courseCount?: number
  exposureInches?: number
  widthFt?: number
  openings?: Array<{ id: string; widthFt: number; heightFt: number; include: boolean }>
  wastePercent?: number
  notes?: string
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 })

  const measurementId = request.nextUrl.searchParams.get('measurementId')
  if (!isUuid(measurementId)) return NextResponse.json({ error: 'A valid measurementId is required.' }, { status: 400 })

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError || !isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required for siding measurement approval.' }, { status: 403 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as VerifyBody

  const courseCount = Number(body.courseCount)
  const exposureInches = Number(body.exposureInches)
  const widthFt = Number(body.widthFt)
  const wastePercent = Number(body.wastePercent)
  const openings = Array.isArray(body.openings) ? body.openings : []

  if (![courseCount, exposureInches, widthFt, wastePercent].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Enter the technician-verified siding measurements before approving.' }, { status: 400 })
  }
  if (openings.length > 100) return NextResponse.json({ error: 'Too many openings.' }, { status: 400 })
  if ((body.notes?.length ?? 0) > 5000) return NextResponse.json({ error: 'Notes exceed the supported size.' }, { status: 400 })

  let calculation
  try {
    calculation = calculateSidingMeasurement({ courseCount, exposureInches, widthFt, openings, wastePercent })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid siding measurements.' }, { status: 400 })
  }

  if (!Number.isFinite(calculation.orderAreaSqFt) || calculation.orderAreaSqFt <= 0 || calculation.orderAreaSqFt > 100_000) {
    return NextResponse.json({ error: 'The derived siding quantity is outside supported safety limits.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const verification = {
    verifiedBy: user.id,
    verifiedAt: now,
    courseCount,
    exposureInches,
    widthFt,
    openings,
    wastePercent,
    calculation,
    notes: body.notes?.trim() || null,
    decision: 'verified_by_technician',
  }

  const { data: updated, error: updateError } = await supabase
    .from('siding_measurements')
    .update({
      course_count: courseCount,
      exposure_inches: exposureInches,
      width_ft: widthFt,
      openings,
      waste_percent: wastePercent,
      calculated_height_ft: calculation.calculatedHeightFt,
      gross_area_sq_ft: calculation.grossAreaSqFt,
      opening_deduction_sq_ft: calculation.openingDeductionSqFt,
      net_area_sq_ft: calculation.netAreaSqFt,
      waste_sq_ft: calculation.wasteSqFt,
      order_area_sq_ft: calculation.orderAreaSqFt,
      status: 'verified',
      verified_by: user.id,
      verified_at: now,
      verification,
      updated_at: now,
    })
    .eq('id', measurementId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'unverified')
    .select('id,status,course_count,exposure_inches,width_ft,openings,waste_percent,calculated_height_ft,gross_area_sq_ft,opening_deduction_sq_ft,net_area_sq_ft,waste_sq_ft,order_area_sq_ft,verified_by,verified_at,verification')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'Could not verify siding measurement. It may already be verified or no longer be available for approval.' }, { status: 409 })
  }

  return NextResponse.json({ measurement: updated, verification, warning: 'Verified siding quantity is now eligible for controlled downstream use.' })
}
