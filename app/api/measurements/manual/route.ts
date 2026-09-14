import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  let body: { roofAreaSqft?: number; roofSquares?: number; gutterLf?: number; ridgeLf?: number; eaveLf?: number; rakeLf?: number; valleyLf?: number; pitch?: string; notes?: string; sourceReference?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const values = [body.roofAreaSqft, body.roofSquares, body.gutterLf, body.ridgeLf, body.eaveLf, body.rakeLf, body.valleyLf].filter((value) => value !== undefined)
  if (!values.length || values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) return NextResponse.json({ error: 'At least one non-negative measurement is required.' }, { status: 400 })
  const { data, error } = await supabase.from('inspection_measurements').insert({ workspace_id: workspaceId, source_type: 'manual', confidence: 'unverified', roof_area_sqft: body.roofAreaSqft ?? null, roof_squares: body.roofSquares ?? null, gutter_lf: body.gutterLf ?? null, ridge_lf: body.ridgeLf ?? null, eave_lf: body.eaveLf ?? null, rake_lf: body.rakeLf ?? null, valley_lf: body.valleyLf ?? null, pitch: body.pitch?.trim() || null, source_reference: body.sourceReference?.trim() || 'owner-entered', notes: body.notes?.trim() || null, created_by: user.id }).select('id,source_type,confidence,roof_area_sqft,roof_squares,gutter_lf,pitch,captured_at').single()
  if (error) return NextResponse.json({ error: 'Could not save measurement.', detail: error.message }, { status: 502 })
  return NextResponse.json({ measurement: data, warning: 'Manual measurements remain unverified until reviewed.' }, { status: 201 })
}
