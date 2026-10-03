import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  const assetUrl = typeof body.assetUrl === 'string' ? body.assetUrl : ''
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  if (!/^https:\/\//i.test(assetUrl)) return NextResponse.json({ error: 'assetUrl must be an HTTPS URL from approved storage.' }, { status: 400 })
  const sourceType = typeof body.sourceType === 'string' ? body.sourceType : 'drone_photo'
  if (!['drone_photo', 'drone_video', 'orthomosaic', 'oam_imagery', 'arcgis_imagery'].includes(sourceType)) return NextResponse.json({ error: 'Unsupported aerial source type.' }, { status: 400 })
  if (body.inspectionId !== undefined && body.inspectionId !== null) {
    if (!isUuid(body.inspectionId)) return NextResponse.json({ error: 'inspectionId must be a valid workspace inspection UUID.' }, { status: 400 })
    const { data: inspection, error: inspectionError } = await supabase.from('inspection_sessions').select('id').eq('id', body.inspectionId).eq('workspace_id', workspaceId).maybeSingle()
    if (inspectionError) return NextResponse.json({ error: 'Could not validate inspection access.' }, { status: 503 })
    if (!inspection) return NextResponse.json({ error: 'The inspection does not belong to this workspace.' }, { status: 400 })
  }
  const numeric = { latitude: body.latitude, longitude: body.longitude, altitudeM: body.altitudeM, headingDeg: body.headingDeg }
  if (numeric.latitude !== undefined && numeric.latitude !== null && (!Number.isFinite(Number(numeric.latitude)) || Number(numeric.latitude) < -90 || Number(numeric.latitude) > 90)) return NextResponse.json({ error: 'latitude must be between -90 and 90.' }, { status: 400 })
  if (numeric.longitude !== undefined && numeric.longitude !== null && (!Number.isFinite(Number(numeric.longitude)) || Number(numeric.longitude) < -180 || Number(numeric.longitude) > 180)) return NextResponse.json({ error: 'longitude must be between -180 and 180.' }, { status: 400 })
  if (numeric.altitudeM !== undefined && numeric.altitudeM !== null && (!Number.isFinite(Number(numeric.altitudeM)) || Number(numeric.altitudeM) < -1000 || Number(numeric.altitudeM) > 100000)) return NextResponse.json({ error: 'altitudeM is outside supported bounds.' }, { status: 400 })
  if (numeric.headingDeg !== undefined && numeric.headingDeg !== null && (!Number.isFinite(Number(numeric.headingDeg)) || Number(numeric.headingDeg) < 0 || Number(numeric.headingDeg) >= 360)) return NextResponse.json({ error: 'headingDeg must be from 0 up to but not including 360.' }, { status: 400 })
  const boundedText = { thumbnailUrl: body.thumbnailUrl, cameraMake: body.cameraMake, cameraModel: body.cameraModel, license: body.license, provider: body.provider, notes: body.notes }
  if (Object.entries(boundedText).some(([, value]) => value !== undefined && value !== null && typeof value !== 'string')) return NextResponse.json({ error: 'Aerial metadata text fields must be strings.' }, { status: 400 })
  if (typeof body.notes === 'string' && body.notes.length > 5_000) return NextResponse.json({ error: 'notes must be 5,000 characters or fewer.' }, { status: 400 })

  const { data, error } = await supabase.from('drone_captures').insert({ workspace_id: workspaceId, inspection_id: body.inspectionId ?? null, source_type: sourceType, asset_url: assetUrl, thumbnail_url: body.thumbnailUrl ?? null, captured_at: body.capturedAt ?? null, latitude: body.latitude ?? null, longitude: body.longitude ?? null, altitude_m: body.altitudeM ?? null, heading_deg: body.headingDeg ?? null, camera_make: body.cameraMake ?? null, camera_model: body.cameraModel ?? null, license: body.license ?? null, provider: body.provider ?? null, confidence: 'unverified', notes: body.notes ?? null, created_by: user.id }).select('id,source_type,asset_url,confidence,captured_at,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not record drone capture.', detail: error.message }, { status: 502 })
  return NextResponse.json({ capture: data, warning: 'Drone evidence is unverified until telemetry, coverage, date, and measurements are reviewed by an authorized person.' }, { status: 201 })
}
