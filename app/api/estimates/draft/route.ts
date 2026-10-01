import { NextRequest, NextResponse } from 'next/server'
import { getApprovedPhotoWorkflowQuantities } from '../../../../lib/estimates/verified-photo-workflow.mjs'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

type DraftBody = {
  workspaceId?: string
  photoEstimateWorkflowId?: string
  stormEvidenceId?: string
  notes?: string
}

type DraftLineItem = {
  internalCode: string
  description: string
  unit: 'SQ' | 'LF'
  quantity: number
  price: null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as DraftBody
  const allowedKeys = new Set(['workspaceId', 'photoEstimateWorkflowId', 'stormEvidenceId', 'notes'])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: 'Client-supplied quantities and unsupported fields are not accepted. Quantities are derived from technician-approved workflow data.' }, { status: 400 })
  }
  if (!isUuid(body.workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  if (!isUuid(body.photoEstimateWorkflowId)) return NextResponse.json({ error: 'A valid photoEstimateWorkflowId is required.' }, { status: 400 })
  if (body.stormEvidenceId !== undefined && !isUuid(body.stormEvidenceId)) return NextResponse.json({ error: 'stormEvidenceId must be a valid UUID.' }, { status: 400 })
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 5_000)) {
    return NextResponse.json({ error: 'Notes must be a string of 5,000 characters or fewer.' }, { status: 400 })
  }

  const membership = await requireWorkspaceMember(supabase, user.id, body.workspaceId)
  if (membership.response) return membership.response

  const { data: workflow, error: workflowError } = await supabase
    .from('photo_estimate_workflows')
    .select('id,workspace_id,inspection_id,status,roof_squares,gutter_lf,approved_by,approved_at,report')
    .eq('id', body.photoEstimateWorkflowId)
    .eq('workspace_id', body.workspaceId)
    .maybeSingle()
  if (workflowError) return NextResponse.json({ error: 'Could not load the photo-estimate workflow.' }, { status: 503 })
  if (!workflow) return NextResponse.json({ error: 'Photo-estimate workflow not found in this workspace.' }, { status: 404 })

  const approved = getApprovedPhotoWorkflowQuantities(workflow)
  if (!approved) return NextResponse.json({ error: 'A consistent technician-approved workflow with verified roof and gutter quantities is required.' }, { status: 409 })

  const { data: inspection, error: inspectionError } = await supabase
    .from('inspection_sessions')
    .select('id')
    .eq('id', approved.inspectionId)
    .eq('workspace_id', body.workspaceId)
    .maybeSingle()
  if (inspectionError) return NextResponse.json({ error: 'Could not validate the workflow inspection.' }, { status: 503 })
  if (!inspection) return NextResponse.json({ error: 'The approved workflow inspection is unavailable in this workspace.' }, { status: 409 })

  if (body.stormEvidenceId) {
    const { data: evidence, error: evidenceError } = await supabase
      .from('storm_evidence')
      .select('id')
      .eq('id', body.stormEvidenceId)
      .eq('workspace_id', body.workspaceId)
      .eq('inspection_id', approved.inspectionId)
      .maybeSingle()
    if (evidenceError) return NextResponse.json({ error: 'Could not validate storm-evidence access.' }, { status: 503 })
    if (!evidence) return NextResponse.json({ error: 'Storm evidence must belong to this workspace and approved workflow inspection.' }, { status: 400 })
  }

  const lineItems: DraftLineItem[] = [
    { internalCode: 'ROOF-REPLACE', description: 'Roof covering replacement — quantity derived from technician-approved measurements', unit: 'SQ', quantity: approved.roofSquares, price: null },
  ]
  if (approved.gutterLf > 0) {
    lineItems.push({ internalCode: 'GUTTER-REPLACE', description: 'Gutter replacement — quantity derived from technician-approved measurement', unit: 'LF', quantity: approved.gutterLf, price: null })
  }

  const estimateSnapshot = {
    kind: 'replacement-draft',
    priceStatus: 'unpriced',
    measurementSource: {
      kind: 'technician-approved-photo-workflow',
      workflowId: workflow.id,
      inspectionId: approved.inspectionId,
      verifiedBy: approved.approvedBy,
      verifiedAt: approved.approvedAt,
    },
    verifiedQuantities: { roofSquares: approved.roofSquares, gutterLf: approved.gutterLf },
    lineItems,
    notes: body.notes ?? null,
    requiredNextSteps: ['Review source photos and technician verification', 'Attach approved market price book', 'Human approval before external use'],
  }

  const { data: packet, error: insertError } = await supabase
    .from('estimate_review_packets')
    .insert({
      workspace_id: body.workspaceId,
      inspection_id: approved.inspectionId,
      measurement_id: null,
      photo_estimate_workflow_id: workflow.id,
      storm_evidence_id: body.stormEvidenceId ?? null,
      status: 'needs_price_review',
      price_source: 'unpriced-draft',
      formula_version: 'approved-photo-workflow-v1',
      estimate_snapshot: estimateSnapshot,
      created_by: user.id,
    })
    .select('id,status,estimate_snapshot,created_at')
    .single()
  if (insertError) return NextResponse.json({ error: 'Could not create the review-gated draft packet.' }, { status: 502 })

  return NextResponse.json({
    packet,
    warning: 'Quantities came from a technician-approved workflow. This remains an unpriced draft, not an insurance estimate, and must not be sent externally.',
  }, { status: 201 })
}
