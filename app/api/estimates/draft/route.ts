import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: { workspaceId?: string; inspectionId?: string; measurementId?: string; stormEvidenceId?: string; roofSquares?: number; gutterLf?: number; notes?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  if (!body.workspaceId || !/^[0-9a-f-]{36}$/i.test(body.workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  const roofSquares = Number(body.roofSquares)
  const gutterLf = Number(body.gutterLf)
  if (!Number.isFinite(roofSquares) || roofSquares <= 0 || !Number.isFinite(gutterLf) || gutterLf < 0) return NextResponse.json({ error: 'Valid roofSquares and gutterLf are required.' }, { status: 400 })

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
