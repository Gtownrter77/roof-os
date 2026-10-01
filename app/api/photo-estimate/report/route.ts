import { NextRequest, NextResponse } from 'next/server'
import { getApprovedPhotoWorkflowQuantities } from '../../../../lib/estimates/verified-photo-workflow.mjs'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

type Workflow = {
  id: string
  workspace_id: string
  lead_id: string | null
  inspection_id: string | null
  status: string
  address: string | null
  latitude: number | string | null
  longitude: number | string | null
  footprint_sqft: number | string | null
  storm_candidates: unknown
  estimate: unknown
  report: unknown
  source_photo_ids: unknown
  ai_analysis: unknown
  approved_by: string | null
  approved_at: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Authentication required.', 401)

  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !isUuid(workspaceId)) return jsonError('An active workspace is required.', 403)
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return jsonError(parsed.error, parsed.status)
  const body = parsed.body
  if (Object.keys(body).some((key) => key !== 'workflowId')) return jsonError('Only workflowId is supported.', 400)
  const workflowId = body.workflowId
  if (!isUuid(workflowId)) return jsonError('A valid workflowId is required.', 400)

  const { data: workflow, error: workflowError } = await supabase
    .from('photo_estimate_workflows')
    .select('id,workspace_id,lead_id,inspection_id,status,address,latitude,longitude,footprint_sqft,storm_candidates,estimate,report,source_photo_ids,ai_analysis,approved_by,approved_at')
    .eq('id', workflowId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (workflowError) return jsonError('The photo workflow could not be loaded.', 503)
  if (!workflow) return jsonError('Photo workflow not found in this workspace.', 404)

  const row = workflow as Workflow
  if (row.status !== 'approved' || !row.approved_by || !row.approved_at) {
    return jsonError('Technician approval is required before a full report can be generated.', 409)
  }
  if (!row.address?.trim() || !isUuid(row.inspection_id)) {
    return jsonError('The approved workflow must include a property address and inspection.', 409)
  }
  const sourcePhotoIds = row.source_photo_ids
  if (!Array.isArray(sourcePhotoIds) || sourcePhotoIds.length < 1 || sourcePhotoIds.length > 50 || sourcePhotoIds.some((id) => !isUuid(id)) || new Set(sourcePhotoIds).size !== sourcePhotoIds.length) {
    return jsonError('The approved workflow has no valid source photo set.', 409)
  }

  const approved = getApprovedPhotoWorkflowQuantities(row)
  if (!approved) return jsonError('The approved workflow measurements are inconsistent and cannot produce a full report.', 409)

  const existingReport = isRecord(row.report) ? row.report : {}
  const technicianVerification = isRecord(existingReport.technicianVerification) ? existingReport.technicianVerification : null
  const estimate = isRecord(row.estimate) ? row.estimate : {}
  const propertyEvidence = isRecord(existingReport.propertyEvidence) ? existingReport.propertyEvidence : {}
  const stormEvidence = Array.isArray(row.storm_candidates) ? row.storm_candidates : []
  const { data: priceBook } = await supabase
    .from('price_books')
    .select('id,name,effective_at,local_tax_rate,tax_source')
    .eq('workspace_id', workspaceId)
    .eq('source', 'owner-managed')
    .eq('status', 'active')
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const generatedAt = new Date().toISOString()
  const fullReport = {
    version: 'photo-to-full-report-v1',
    title: `ROOF/OS Full Inspection Report — ${row.address.trim()}`,
    status: 'needs_human_review',
    generatedAt,
    property: {
      address: row.address.trim(),
      geocode: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
      footprintSqFt: Number(row.footprint_sqft ?? propertyEvidence.footprintSqFt ?? 0),
      footprintSource: propertyEvidence.source ?? 'OpenStreetMap building footprint assist',
      footprintConfidence: propertyEvidence.confidence ?? 'low',
    },
    sourceEvidence: {
      inspectionId: row.inspection_id,
      photoIds: sourcePhotoIds,
      photoCount: sourcePhotoIds.length,
      aiObservations: row.ai_analysis ?? null,
      stormCandidates: stormEvidence,
    },
    technicianVerification: {
      ...technicianVerification,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      decision: 'verified_by_technician',
    },
    quantities: {
      roofSquares: approved.roofSquares,
      gutterLf: approved.gutterLf,
      soffitLf: Number(technicianVerification?.soffitLf ?? technicianVerification?.eaveLf ?? 0),
      fasciaLf: Number(technicianVerification?.fasciaLf ?? technicianVerification?.eaveLf ?? 0),
    },
    estimateReview: {
      status: 'needs_price_review',
      priceBook: priceBook ? { id: priceBook.id, name: priceBook.name, effectiveAt: priceBook.effective_at, localTaxRate: Number(priceBook.local_tax_rate ?? 0), taxSource: priceBook.tax_source ?? 'owner-entered local rate' } : null,
      source: 'technician-approved photo workflow',
      lineItems: [
        { internalCode: 'ROOF-REPLACE', description: 'Roof covering replacement', unit: 'SQ', quantity: approved.roofSquares, price: null },
        ...(approved.gutterLf > 0 ? [{ internalCode: 'GUTTER-REPLACE', description: 'Gutter replacement', unit: 'LF', quantity: approved.gutterLf, price: null }] : []),
      ],
      note: 'Pricing remains unpriced until an owner-managed price book is attached and a human approves the estimate review packet.',
    },
    requiredReview: [
      'Confirm the photographed property matches the stated address and inspection.',
      'Review every source photo and any AI observation; AI findings are non-authoritative.',
      'Confirm technician measurements, roof type, pitch, waste factor, eaves, fascia, and gutters.',
      'Treat weather records as corroborating candidates only, not a proven date of loss.',
      'Attach or confirm an approved owner-managed price book before pricing.',
      'Complete human review before customer, carrier, or insurance delivery.',
    ],
  }

  const nextReport = { ...existingReport, fullReport, status: 'full_report_generated' }
  const { data: updated, error: updateError } = await supabase
    .from('photo_estimate_workflows')
    .update({ report: nextReport, updated_at: generatedAt })
    .eq('id', row.id)
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')
    .select('id,status,report,updated_at')
    .single()
  if (updateError || !updated) return jsonError('The full report could not be saved.', 502)

  if (row.lead_id) {
    await supabase
      .from('leads')
      .update({ status: 'report_pending', updated_at: generatedAt })
      .eq('id', row.lead_id)
      .eq('workspace_id', workspaceId)
  }

  return NextResponse.json({ workflow: updated, report: fullReport, warning: 'This full report is review-gated and is not customer-ready until human review is complete.' })
}
