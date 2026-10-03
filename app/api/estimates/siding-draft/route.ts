import { NextRequest, NextResponse } from 'next/server'
import { getApprovedSidingMeasurementQuantity } from '../../../../lib/estimates/verified-siding-measurement.mjs'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { workspaceId?: string; sidingMeasurementId?: string; notes?: string }
  const allowedKeys = new Set(['workspaceId', 'sidingMeasurementId', 'notes'])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: 'Client-supplied quantities and unsupported fields are not accepted.' }, { status: 400 })
  }
  if (!isUuid(body.workspaceId) || !isUuid(body.sidingMeasurementId)) {
    return NextResponse.json({ error: 'Valid workspaceId and sidingMeasurementId are required.' }, { status: 400 })
  }
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 5000)) {
    return NextResponse.json({ error: 'Notes must be a string of 5,000 characters or fewer.' }, { status: 400 })
  }

  const membership = await requireWorkspaceMember(supabase, user.id, body.workspaceId)
  if (membership.response) return membership.response

  const { data: measurement, error: measurementError } = await supabase
    .from('siding_measurements')
    .select('id,workspace_id,inspection_id,source_photo_id,status,order_area_sq_ft,net_area_sq_ft,gross_area_sq_ft,waste_sq_ft,calculated_height_ft,course_count,exposure_inches,width_ft,waste_percent,openings,verified_by,verified_at')
    .eq('id', body.sidingMeasurementId)
    .eq('workspace_id', body.workspaceId)
    .maybeSingle()
  if (measurementError) return NextResponse.json({ error: 'Could not load the siding measurement.' }, { status: 503 })

  const approved = getApprovedSidingMeasurementQuantity(measurement)
  if (!approved) return NextResponse.json({ error: 'A consistent technician-verified siding measurement is required.' }, { status: 409 })

  const { data: inspection, error: inspectionError } = await supabase
    .from('inspection_sessions')
    .select('id')
    .eq('id', approved.inspectionId)
    .eq('workspace_id', body.workspaceId)
    .maybeSingle()
  if (inspectionError) return NextResponse.json({ error: 'Could not validate the siding inspection.' }, { status: 503 })
  if (!inspection) return NextResponse.json({ error: 'The verified siding inspection is unavailable in this workspace.' }, { status: 409 })

  const estimateSnapshot = {
    kind: 'siding-replacement-draft',
    priceStatus: 'unpriced',
    measurementSource: {
      kind: 'technician-verified-siding-measurement',
      measurementId: measurement.id,
      inspectionId: approved.inspectionId,
      sourcePhotoId: approved.sourcePhotoId,
      verifiedBy: approved.verifiedBy,
      verifiedAt: approved.verifiedAt,
    },
    verifiedQuantities: { sidingSqFt: approved.sidingSqFt },
    lineItems: [
      { internalCode: 'SIDING-REPLACE', description: 'Siding replacement — quantity derived from technician-verified measurement', unit: 'SQ', quantity: approved.sidingSqFt, price: null },
    ],
    notes: body.notes ?? null,
    requiredNextSteps: ['Review source photo and technician verification', 'Attach approved market price book', 'Human approval before external use'],
  }

  const { data: packet, error: insertError } = await supabase
    .from('estimate_review_packets')
    .insert({
      workspace_id: body.workspaceId,
      inspection_id: approved.inspectionId,
      measurement_id: null,
      siding_measurement_id: measurement.id,
      photo_estimate_workflow_id: null,
      storm_evidence_id: null,
      status: 'needs_price_review',
      price_source: 'unpriced-draft',
      formula_version: 'approved-siding-measurement-v1',
      estimate_snapshot: estimateSnapshot,
      created_by: user.id,
    })
    .select('id,status,estimate_snapshot,created_at')
    .single()
  if (insertError) return NextResponse.json({ error: 'Could not create the review-gated siding draft packet.', detail: insertError.message }, { status: 502 })

  return NextResponse.json({
    packet,
    warning: 'The siding quantity came from a technician-verified measurement. This remains an unpriced draft and must receive human approval before external use.',
  }, { status: 201 })
}
