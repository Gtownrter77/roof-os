import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { calculateSidingMeasurement } from '../../../../lib/siding/measurement'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as any
  if (body.inspectionId && !isUuid(body.inspectionId)) return NextResponse.json({ error: 'inspectionId must be a UUID.' }, { status: 400 })
  if (body.sourcePhotoId && !isUuid(body.sourcePhotoId)) return NextResponse.json({ error: 'sourcePhotoId must be a UUID.' }, { status: 400 })
  try {
    const result = calculateSidingMeasurement(body)
    const { data, error } = await supabase.from('siding_measurements').insert({
      workspace_id: workspaceId, inspection_id: body.inspectionId ?? null, source_photo_id: body.sourcePhotoId ?? null,
      elevation: String(body.elevation || 'unknown').slice(0, 120), course_count: body.courseCount, exposure_inches: body.exposureInches,
      width_ft: body.widthFt, openings: body.openings ?? [], waste_percent: body.wastePercent,
      calculated_height_ft: result.calculatedHeightFt, gross_area_sqft: result.grossAreaSqFt,
      opening_deduction_sqft: result.openingDeductionSqFt, net_area_sqft: result.netAreaSqFt, order_area_sqft: result.orderAreaSqFt,
      status: 'unverified', created_by: user.id
    }).select('*').single()
    if (error) return NextResponse.json({ error: 'Could not save siding measurement.', detail: error.message }, { status: 502 })
    return NextResponse.json({ measurement: data, calculation: result }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid siding measurement.' }, { status: 400 })
  }
}
