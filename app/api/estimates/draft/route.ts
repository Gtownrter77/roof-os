import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { workspaceId?: string; inspectionId?: string; measurementId?: string; stormEvidenceId?: string; roofSquares?: number; gutterLf?: number; notes?: string }
  if (!isUuid(body.workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, body.workspaceId)
  if (membership.response) return membership.response
  for (const [field, value] of [['inspectionId', body.inspectionId], ['measurementId', body.measurementId], ['stormEvidenceId', body.stormEvidenceId]] as const) {
    if (value !== undefined && !isUuid(value)) return NextResponse.json({ error: `${field} must be a valid UUID.` }, { status: 400 })
  }
  const roofSquares = Number(body.roofSquares)
  const gutterLf = Number(body.gutterLf)
  if (!Number.isFinite(roofSquares) || roofSquares <= 0 || roofSquares > 100_000 || !Number.isFinite(gutterLf) || gutterLf < 0 || gutterLf > 1_000_000) return NextResponse.json({ error: 'Enter realistic roof squares (0–100,000) and gutter length (0–1,000,000 LF).' }, { status: 400 })
  if (typeof body.notes === 'string' && body.notes.length > 5_000) return NextResponse.json({ error: 'Notes must be 5,000 characters or fewer.' }, { status: 400 })

  if (body.inspectionId) {
    const { data, error } = await supabase.from('inspection_sessions').select('id').eq('id', body.inspectionId).eq('workspace_id', body.workspaceId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate inspection access.' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'The inspection does not belong to this workspace.' }, { status: 400 })
  }
  if (body.measurementId) {
    const { data, error } = await supabase.from('inspection_measurements').select('id,inspection_id').eq('id', body.measurementId).eq('workspace_id', body.workspaceId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate measurement access.' }, { status: 503 })
    if (!data || (body.inspectionId && data.inspection_id && data.inspection_id !== body.inspectionId)) return NextResponse.json({ error: 'The measurement does not belong to this workspace and inspection.' }, { status: 400 })
  }
  if (body.stormEvidenceId) {
    const { data, error } = await supabase.from('storm_evidence').select('id,inspection_id').eq('id', body.stormEvidenceId).eq('workspace_id', body.workspaceId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate storm-evidence access.' }, { status: 503 })
    if (!data || (body.inspectionId && data.inspection_id && data.inspection_id !== body.inspectionId)) return NextResponse.json({ error: 'The storm evidence does not belong to this workspace and inspection.' }, { status: 400 })
  }

  const estimateSnapshot = {
    kind: 'replacement-draft',
    priceStatus: 'unpriced',
    lineItems: [
      { internalCode: 'ROOF-REPLACE', description: 'Roof covering replacement — quantity requires measurement review', unit: 'SQ', quantity: roofSquares, price: null },
      { internalCode: 'GUTTER-REPLACE', description: 'Gutter replacement — quantity requires measurement review', unit: 'LF', quantity: gutterLf, price: null },
    ],
    notes: body.notes ?? null,
    requiredNextSteps: ['Verify measurement source and confidence', 'Review storm evidence', 'Attach approved market price book', 'Human approval before external use'],
  }
  const { data, error } = await supabase.from('estimate_review_packets').insert({ workspace_id: body.workspaceId, inspection_id: body.inspectionId ?? null, measurement_id: body.measurementId ?? null, storm_evidence_id: body.stormEvidenceId ?? null, status: 'needs_price_review', price_source: 'unpriced-draft', formula_version: 'claims-draft-v1', estimate_snapshot: estimateSnapshot, created_by: user.id }).select('id,status,estimate_snapshot,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not create draft estimate packet.', detail: error.message }, { status: 502 })
  return NextResponse.json({ packet: data, warning: 'This is a review-gated unpriced draft. It is not an insurance estimate and must not be sent externally.' }, { status: 201 })
}
