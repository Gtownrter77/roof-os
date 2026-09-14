import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  const assetUrl = typeof body.assetUrl === 'string' ? body.assetUrl : ''
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  if (!/^https:\/\//i.test(assetUrl)) return NextResponse.json({ error: 'assetUrl must be an HTTPS URL from approved storage.' }, { status: 400 })
  const sourceType = typeof body.sourceType === 'string' ? body.sourceType : 'drone_photo'
  if (!['drone_photo', 'drone_video', 'orthomosaic', 'oam_imagery', 'arcgis_imagery'].includes(sourceType)) return NextResponse.json({ error: 'Unsupported aerial source type.' }, { status: 400 })

  const { data, error } = await supabase.from('drone_captures').insert({ workspace_id: workspaceId, inspection_id: body.inspectionId ?? null, source_type: sourceType, asset_url: assetUrl, thumbnail_url: body.thumbnailUrl ?? null, captured_at: body.capturedAt ?? null, latitude: body.latitude ?? null, longitude: body.longitude ?? null, altitude_m: body.altitudeM ?? null, heading_deg: body.headingDeg ?? null, camera_make: body.cameraMake ?? null, camera_model: body.cameraModel ?? null, license: body.license ?? null, provider: body.provider ?? null, confidence: 'unverified', notes: body.notes ?? null, created_by: user.id }).select('id,source_type,asset_url,confidence,captured_at,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not record drone capture.', detail: error.message }, { status: 502 })
  return NextResponse.json({ capture: data, warning: 'Drone evidence is unverified until telemetry, coverage, date, and measurements are reviewed by an authorized person.' }, { status: 201 })
}
