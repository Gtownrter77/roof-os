import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { buildInspectionPacket, type Agent3Output } from '../../../../../lib/inspection/packet'

// Reviewable inspection packet: metadata only, no storage URLs, no outbound calls.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { id } = await params

  const { data: inspection, error: inspectionError } = await supabase
    .from('inspection_sessions')
    .select('id,workspace_id,lead_id,status,started_at,completed_at')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (inspectionError) return NextResponse.json({ error: 'Could not load the inspection.', detail: inspectionError.message }, { status: 502 })
  if (!inspection) return NextResponse.json({ error: 'Inspection not found in this workspace.' }, { status: 404 })

  const [photosResult, measurementsResult, agentResult] = await Promise.all([
    supabase
      .from('inspection_photos')
      .select('id,album,caption,mime_type,file_size_bytes,width,height,captured_at,upload_status,object_path')
      .eq('inspection_id', id)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
    supabase
      .from('inspection_measurements')
      .select('id,source_type,confidence,source_reference,captured_at,roof_area_sqft,roof_squares,gutter_lf,ridge_lf,eave_lf,rake_lf,valley_lf,rafter_lf,soffit_lf,fascia_lf,pitch,roof_type')
      .eq('inspection_id', id)
      .eq('workspace_id', workspaceId)
      .order('captured_at', { ascending: true }),
    supabase
      .from('agent_runs')
      .select('output,status,created_at')
      .eq('workspace_id', workspaceId)
      .eq('agent_key', 'inspection_quality')
      .like('event_key', `inspection-quality:${id}:%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (photosResult.error) return NextResponse.json({ error: 'Could not load inspection photos.', detail: photosResult.error.message }, { status: 502 })
  if (measurementsResult.error) return NextResponse.json({ error: 'Could not load inspection measurements.', detail: measurementsResult.error.message }, { status: 502 })
  if (agentResult.error) return NextResponse.json({ error: 'Could not load the Agent 3 review.', detail: agentResult.error.message }, { status: 502 })

  const agent3Output = (agentResult.data?.output ?? null) as Agent3Output

  const packet = buildInspectionPacket({
    inspection,
    photos: photosResult.data ?? [],
    measurements: measurementsResult.data ?? [],
    agent3Output,
  })

  return NextResponse.json({ packet })
}
