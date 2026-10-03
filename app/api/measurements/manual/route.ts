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

  if (!body.leadId && !body.inspectionId) return NextResponse.json({ error: 'A lead or an inspection is required. An unlinked measurement is not saved.' }, { status: 400 })

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

  const { data, error } = await supabase.from('inspection_measurements').insert({
    workspace_id: workspaceId,
    inspection_id: body.inspectionId ?? null,
    source_type: 'manual',
    confidence: 'unverified',
    roof_area_sqft: body.roofAreaSqft ?? null,
    roof_squares: body.roofSquares ?? null,
    gutter_lf: body.gutterLf ?? null,
    ridge_lf: body.ridgeLf ?? null,
    eave_lf: body.eaveLf ?? null,
    rake_lf: body.rakeLf ?? null,
    valley_lf: body.valleyLf ?? null,
    pitch: body.pitch?.trim() || null,
    source_reference: body.sourceReference?.trim() || 'owner-entered',
    notes: body.notes?.trim() || null,
    created_by: user.id
  }).select('id,inspection_id,source_type,confidence,roof_area_sqft,roof_squares,gutter_lf,pitch,captured_at').single()

  if (error) return NextResponse.json({ error: 'Could not save measurement.', detail: error.message }, { status: 502 })

  return NextResponse.json({ measurement: data, warning: 'Manual measurements remain unverified until reviewed.' }, { status: 201 })
}
