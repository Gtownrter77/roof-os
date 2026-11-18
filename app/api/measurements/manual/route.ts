import { purchasableRoofing, roofAreaRangeError } from '../../../../lib/measurements/purchasable-roofing'
import { calculateCalibratedRoofDraft } from '../../../../lib/measurements/calibrated-roof-draft'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const body = parsed.body as {
    leadId?: string
    inspectionId?: string
    roofAreaSqft?: number
    roofSquares?: number
    gutterLf?: number
    ridgeLf?: number
    eaveLf?: number
    rakeLf?: number
    valleyLf?: number
    pitch?: string
    notes?: string
    sourceReference?: string
    sourceType?: string
    confidence?: string
    allowSixSquareRepairThreshold?: boolean
    provisionalGeometryDraft?: boolean
  }

  const numericKeys = ['roofAreaSqft', 'roofSquares', 'gutterLf', 'ridgeLf', 'eaveLf', 'rakeLf', 'valleyLf'] as const
  if (numericKeys.some((key) => body[key] !== undefined && typeof body[key] !== 'number')
    || ['pitch', 'notes', 'sourceReference', 'sourceType', 'confidence'].some((key) => body[key as keyof typeof body] !== undefined && typeof body[key as keyof typeof body] !== 'string')
    || (body.allowSixSquareRepairThreshold !== undefined && typeof body.allowSixSquareRepairThreshold !== 'boolean')
    || (body.provisionalGeometryDraft !== undefined && typeof body.provisionalGeometryDraft !== 'boolean')) {
    return NextResponse.json({ error: 'Measurement fields have invalid types.' }, { status: 400 })
  }

  if (body.provisionalGeometryDraft && body.sourceType !== 'ai_formulated') {
    return NextResponse.json({ error: 'Provisional geometry drafts require an aerial AI source reference.' }, { status: 400 })
  }

  if (body.roofAreaSqft != null) {
    const rangeError = roofAreaRangeError(Number(body.roofAreaSqft))
    if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 })
  }
  if (body.inspectionId) {
    if (!isUuid(body.inspectionId)) return NextResponse.json({ error: 'inspectionId must be a valid UUID.' }, { status: 400 })
    const { data: inspection, error: inspError } = await supabase
      .from('inspection_sessions')
      .select('id')
      .eq('id', body.inspectionId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (inspError) return NextResponse.json({ error: 'Could not validate inspection access.' }, { status: 503 })
    if (!inspection) return NextResponse.json({ error: 'The inspection does not belong to this workspace.' }, { status: 400 })
  }

  if (body.leadId) {
    if (!isUuid(body.leadId)) return NextResponse.json({ error: 'leadId must be a valid UUID.' }, { status: 400 })
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', body.leadId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (leadError) return NextResponse.json({ error: 'Could not validate lead access.' }, { status: 503 })
    if (!lead) return NextResponse.json({ error: 'The lead does not belong to this workspace.' }, { status: 400 })
  }

  const limits: Record<string, number> = {
    roofAreaSqft: 20_000_000,
    roofSquares: 100_000,
    gutterLf: 1_000_000,
    ridgeLf: 1_000_000,
    eaveLf: 1_000_000,
    rakeLf: 1_000_000,
    valleyLf: 1_000_000
  }

  const submitted = Object.entries(limits)
    .map(([key, max]) => [key, body[key as keyof typeof body], max] as const)
    .filter(([, value]) => value !== undefined)

  if (!submitted.length || submitted.some(([, value, max]) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max)) {
    return NextResponse.json({ error: 'Provide realistic non-negative measurements within supported safety limits.' }, { status: 400 })
  }

  if ((body.pitch?.length ?? 0) > 20 || (body.notes?.length ?? 0) > 5_000 || (body.sourceReference?.length ?? 0) > 200) {
    return NextResponse.json({ error: 'Pitch, notes, or source reference exceeds the supported text length.' }, { status: 400 })
  }

  let sourceType: 'manual' | 'ai_formulated' = 'manual'
  let confidence: 'unverified' | 'low' | 'medium' | 'high' = 'unverified'
  let roofAreaSqft = body.roofAreaSqft ?? null
  let roofSquares = body.roofSquares ?? null
  let gutterLf = body.gutterLf ?? null
  let ridgeLf = body.ridgeLf ?? null
  let eaveLf = body.eaveLf ?? null
  let rakeLf = body.rakeLf ?? null
  let valleyLf = body.valleyLf ?? null
  let pitch = body.pitch?.trim() || null
  let notes = body.notes?.trim() || null
  if (body.sourceType === 'ai_formulated') {
    const sourceMatch = typeof body.sourceReference === 'string' ? body.sourceReference.match(/^aerial-geometry:([0-9a-f-]{36})$/i) : null
    if (!sourceMatch || !isUuid(sourceMatch[1])) {
      return NextResponse.json({ error: 'AI-formulated measurements require a verified aerial measurement reference.' }, { status: 400 })
    }
    const { data: aerialMeasurement, error: aerialError } = await supabase
      .from('aerial_measurements')
      .select('id,inspection_id,measurement_source,ai_formulation,status,calibration_status,orthographic_top_down_confirmed,uniform_pitch_confirmed,confirmed_uniform_pitch_rise_per_12,scale_reference_pixels,scale_reference_feet')
      .eq('id', sourceMatch[1])
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (aerialError) return NextResponse.json({ error: 'AI measurement provenance could not be verified.' }, { status: 503 })
    if (!aerialMeasurement || aerialMeasurement.measurement_source !== 'ai_formulated' || aerialMeasurement.inspection_id !== (body.inspectionId ?? null)) {
      return NextResponse.json({ error: 'The aerial measurement reference is not valid for this workspace and inspection.' }, { status: 400 })
    }
    if (body.provisionalGeometryDraft) {
      if (aerialMeasurement.status !== 'confirmed' || aerialMeasurement.calibration_status !== 'confirmed'
        || aerialMeasurement.orthographic_top_down_confirmed !== true) {
        return NextResponse.json({ error: 'Confirmed human-reviewed roof geometry is required before a provisional draft can be saved.' }, { status: 409 })
      }
      confidence = 'unverified'
    }
    if (aerialMeasurement.status !== 'confirmed' || aerialMeasurement.calibration_status !== 'confirmed'
      || aerialMeasurement.orthographic_top_down_confirmed !== true) {
      return NextResponse.json({ error: 'Reviewed, calibrated and confirmed roof geometry is required before saving derived quantities.' }, { status: 409 })
    }
    const { data: persistedPlanes, error: planeError } = await supabase.from('roof_planes')
      .select('vertices,review_status,reviewed_pitch_rise_per_12')
      .eq('workspace_id', workspaceId).eq('aerial_measurement_id', aerialMeasurement.id)
    if (planeError) return NextResponse.json({ error: 'Reviewed roof planes could not be loaded.', }, { status: 503 })
    let derived
    try {
      derived = calculateCalibratedRoofDraft({
        planes: (persistedPlanes ?? []).map(plane => ({
          vertices: plane.vertices, review_status: plane.review_status,
          ...(plane.reviewed_pitch_rise_per_12 == null ? {} : { pitchRisePer12: Number(plane.reviewed_pitch_rise_per_12) }),
        })),
        scaleReferencePixels: Number(aerialMeasurement.scale_reference_pixels),
        scaleReferenceFeet: Number(aerialMeasurement.scale_reference_feet),
        pitchRisePer12: aerialMeasurement.uniform_pitch_confirmed ? Number(aerialMeasurement.confirmed_uniform_pitch_rise_per_12) : 0,
        orthographicTopDownConfirmed: true,
        uniformPitchConfirmed: aerialMeasurement.uniform_pitch_confirmed === true,
        geometryConfirmed: true,
      })
    } catch {
      return NextResponse.json({ error: 'Saved geometry or pitch is unreviewed, inconsistent or overlapping.' }, { status: 409 })
    }
    // The client has only a preview. Reject changed/stale values rather than
    // silently saving a different area, and NEVER use AI formulation area.
    if (body.roofAreaSqft != null && Math.abs(body.roofAreaSqft - derived.roofAreaSqFt) > 0.05) {
      return NextResponse.json({ error: 'The displayed measurement is stale. Refresh the reviewed roof geometry.' }, { status: 409 })
    }
    sourceType = 'ai_formulated'
    const formulation = aerialMeasurement.ai_formulation as { confidence?: unknown; assumptions?: unknown } | null
    const formulatedConfidence = formulation?.confidence
    confidence = formulatedConfidence === 'low' || formulatedConfidence === 'medium' || formulatedConfidence === 'high' ? formulatedConfidence : 'unverified'
    roofAreaSqft = derived.roofAreaSqFt
    roofSquares = derived.roofSquares
    // Unreviewed model edge lengths do not become approved measurements.
    gutterLf = null; ridgeLf = null; eaveLf = null; rakeLf = null; valleyLf = null
    pitch = aerialMeasurement.uniform_pitch_confirmed
      ? `${aerialMeasurement.confirmed_uniform_pitch_rise_per_12}/12` : 'mixed'
    notes = `Calculated from persisted reviewed polygons, scale and ${pitch} pitch; ${derived.planAreaSqFt} sq ft plan, ${derived.roofAreaSqFt} sq ft slope-adjusted. Unverified draft; review all classified edge quantities separately.`
  }
  const order = roofAreaSqft != null ? purchasableRoofing(roofAreaSqft, body.allowSixSquareRepairThreshold === true) : null
  const { data, error } = await supabase.from('inspection_measurements').insert({
    workspace_id: workspaceId,
    inspection_id: body.inspectionId ?? null,
    source_type: sourceType,
    confidence,
    roof_area_sqft: roofAreaSqft,
    roof_squares: sourceType === 'ai_formulated' ? roofSquares : order?.squares ?? roofSquares,
    gutter_lf: gutterLf,
    ridge_lf: ridgeLf,
    eave_lf: eaveLf,
    rake_lf: rakeLf,
    valley_lf: valleyLf,
    source_reference: body.sourceReference?.trim() || 'owner-entered',
    pitch,
    notes: [notes, order ? `${order.squaresLabel} · ${order.bundles} standard bundles · ${order.jobLabel}` : null].filter(Boolean).join(' ') || null,
    created_by: user.id
  }).select('id,inspection_id,source_type,confidence,roof_area_sqft,roof_squares,gutter_lf,pitch,captured_at').single()

  if (error) return NextResponse.json({ error: 'Could not save measurement.', detail: error.message }, { status: 502 })

  return NextResponse.json({ measurement: data, warning: sourceType === 'ai_formulated' ? 'AI-formulated measurement saved with provenance.' : 'Manual measurement saved.' }, { status: 201 })
}
