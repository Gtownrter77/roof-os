import { NextRequest, NextResponse } from 'next/server'
import { getApprovedPhotoWorkflowQuantities } from '../../../../lib/estimates/verified-photo-workflow.mjs'
import { getGoldenReportContractErrors } from '../../../../lib/reports/golden-report.mjs'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

type Workflow = {
  id: string
  workspace_id: string
  lead_id: string | null
  inspection_id: string | null
  status: string
  address: string | null
  report: unknown
  source_photo_ids: unknown
  approved_by: string | null
  approved_at: string | null
  technician_name?: string | null
  technician_license?: string | null
  technician_signature?: string | null
  photo_reviews?: unknown
  manager_approval_name?: string | null
  manager_approval_signature?: string | null
  manager_approved_at?: string | null
  roof_squares: number | string | null
  gutter_lf: number | string | null
}

type PhotoRow = {
  id: string
  captured_at: string | null
  mime_type: string
  upload_status: string
  caption: string | null
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
    .select('id,workspace_id,lead_id,inspection_id,status,address,report,source_photo_ids,approved_by,approved_at,roof_squares,gutter_lf,technician_name,technician_license,technician_signature,photo_reviews,manager_approval_name,manager_approval_signature,manager_approved_at')
    .eq('id', workflowId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (workflowError) return jsonError('The photo workflow could not be loaded.', 503)
  if (!workflow) return jsonError('Photo workflow not found in this workspace.', 404)

  const row = workflow as Workflow
  if (row.status !== 'approved' || !row.approved_by || !row.approved_at) return jsonError('Technician approval is required before a report can be generated.', 409)
  if (!row.manager_approval_name || !row.manager_approval_signature || !row.manager_approved_at) return jsonError('Owner or manager approval is required before a Golden Report can be generated.', 409)
  if (!row.address?.trim() || !isUuid(row.inspection_id)) {
    return jsonError('The approved workflow must include a property address and inspection.', 409)
  }
  const sourcePhotoIds = row.source_photo_ids
  if (!Array.isArray(sourcePhotoIds) || sourcePhotoIds.length < 1 || sourcePhotoIds.length > 50 || sourcePhotoIds.some((id) => !isUuid(id)) || new Set(sourcePhotoIds).size !== sourcePhotoIds.length) {
    return jsonError('The approved workflow has no valid source photo set.', 409)
  }

  const approved = getApprovedPhotoWorkflowQuantities(row)
  if (!approved) return jsonError('The approved workflow measurements are inconsistent and cannot produce a report.', 409)

  const { data: photoRows, error: photoError } = await supabase
    .from('inspection_photos')
    .select('id,captured_at,mime_type,upload_status,caption')
    .eq('workspace_id', workspaceId)
    .eq('inspection_id', row.inspection_id)
    .in('id', sourcePhotoIds)
  if (photoError) return jsonError('The source photo records could not be loaded.', 503)
  if (!Array.isArray(photoRows) || photoRows.length !== sourcePhotoIds.length) {
    return jsonError('Every source photo must still belong to this workspace and inspection.', 409)
  }
  const photos = photoRows as PhotoRow[]
  const photoReviews = Array.isArray(row.photo_reviews) ? row.photo_reviews as Array<{ photoId?: string; usability?: string; coverage?: string; notes?: string | null }> : []
  if (sourcePhotoIds.some((id) => !photoReviews.some((review) => review.photoId === id))) return jsonError('Every source photo requires a usability and coverage review before the report can be generated.', 409)
  if (photos.some((photo) => photo.upload_status !== 'uploaded')) {
    return jsonError('Every source photo must finish uploading before the report can be generated.', 409)
  }

  const existingReport = isRecord(row.report) ? row.report : {}
  const verification = isRecord(existingReport.technicianVerification) ? existingReport.technicianVerification : {}
  const reportId = row.id
  const generatedAt = new Date().toISOString()
  const photosInReportOrder = sourcePhotoIds.map((id, index) => {
    const photo = photos.find((candidate) => candidate.id === id)!
    const review = photoReviews.find((candidate) => candidate.photoId === id)
    return {
      id,
      altText: `Inspection photo ${index + 1}. Content description: Unknown.`,
      caption: photo.caption?.trim() ? `${photo.caption.trim()} (recorded caption; not verified)` : 'Unknown',
      capturedAt: photo.captured_at || 'Unknown',
      mimeType: photo.mime_type,
      usability: review ? `${review.usability ?? 'Unknown'}; coverage: ${review.coverage ?? 'Unknown'}${review.notes ? `; note: ${review.notes}` : ''}` : 'Unknown. No photo usability review is recorded.',
    }
  })

  const measurementItems = [
    { label: 'Roof area', value: `${approved.roofSquares} squares`, source: 'Calculated from technician-verified eave length, rafter length, pitch, and waste factor.' },
    { label: 'Pitch', value: `${verification.pitch}/12`, source: 'Technician measurement recorded during approval.' },
    { label: 'Rafter length', value: `${verification.rafterLf} linear feet`, source: 'Technician measurement recorded during approval.' },
    { label: 'Ridge length', value: 'Unknown', source: 'Unknown. No verified ridge measurement is recorded.' },
    { label: 'Eave length', value: `${verification.eaveLf} linear feet`, source: 'Technician measurement recorded during approval.' },
    { label: 'Waste factor', value: `${(Number(verification.wasteFactor) * 100).toFixed(0)}%`, source: 'Technician-selected calculation input recorded during approval.' },
    { label: 'Rake length', value: 'Unknown', source: 'Unknown. No verified rake measurement is recorded.' },
    { label: 'Valley length', value: 'Unknown', source: 'Unknown. No verified valley measurement is recorded.' },
    { label: 'Gutter length', value: `${approved.gutterLf} linear feet`, source: 'Technician measurement recorded during approval.' },
    { label: 'Fascia length', value: 'Unknown', source: 'Unknown. No separate verified fascia measurement is recorded.' },
    { label: 'Soffit area', value: 'Unknown', source: 'Unknown. No verified soffit area is recorded.' },
    { label: 'Aerial roof measurement', value: 'Unknown', source: 'Unknown. No reviewed aerial roof measurement is linked to this inspection.' },
  ]

  const fullReport = {
    version: 'golden-report-v1.0',
    reportId,
    title: `ROOF INSPECTION REPORT — ${row.address.trim()}`,
    status: 'draft',
    generatedAt,
    sections: [
      {
        id: 'cover',
        title: '1. Cover',
        statements: [
          'Prepared for: Unknown.',
          `Property address: ${row.address.trim()}.`,
          'Prepared by: Unknown. A technician display name and company name are not recorded.',
          `Date of report: ${generatedAt}.`,
          'Photos taken: Unknown unless a capture date is listed for a photo in Section 2.',
          'This report describes the roof using the on-site photos and technician measurements listed below. Each known fact names its source. Unknown facts are marked Unknown.',
          'We educate. You decide.',
        ],
      },
      {
        id: 'looked-at',
        title: '2. What we looked at',
        statements: ['The list below contains the source photos linked to this inspection. Photo usability is Unknown until a person records a review.'],
        photos: photosInReportOrder,
      },
      {
        id: 'saw',
        title: '3. What we saw',
        statements: [
          'Unknown. No photo-linked observation has been confirmed by a technician.',
          'AI observations are not included until a technician confirms them.',
        ],
      },
      {
        id: 'did-not-see',
        title: '4. What we did not see',
        statements: ['Unknown. No photo-by-photo coverage review is recorded. Do not use this report to infer what a photo did not show.'],
      },
      {
        id: 'storms',
        title: '5. Storm history',
        statements: ['Unknown. NOAA Storm Events Database records are not connected to this report. Weather alerts are not listed as storm-history records.'],
      },
      {
        id: 'measurements',
        title: '6. Measurements',
        statements: ['Each known number below names its source. Unknown means that no verified value and source are recorded.'],
        items: measurementItems,
      },
      {
        id: 'verification',
        title: '7. Verification',
        statements: [
          `Verified by: ${row.technician_name || 'Unknown'}. License / registration: ${row.technician_license || 'Unknown'}.`,
          `Verified on: ${row.approved_at}.`,
          'Verified values: roof area, pitch, eave length, rafter length, waste factor, and gutter length. Each is tied to the technician approval record.',
          'Corrected values: Unknown. No separate correction list is recorded.',
          'Unverified: photo observations, photo usability, storm history, ridge, rake, valley, fascia, soffit area, aerial roof measurement, building codes, and supplements.',
          `Technician signature: ${row.technician_signature ? 'Captured.' : 'Unknown.'}`,
        ],
      },
      {
        id: 'codes',
        title: '8. Applicable building codes',
        statements: ['Unknown. A code source tied to the property jurisdiction and section numbers is not linked to this report.'],
      },
      {
        id: 'supplements',
        title: '9. Projected supplements',
        statements: ['Unknown. No projected supplement with a verified photo or code source is linked to this report. No item is approved by this report.'],
      },
      {
        id: 'not',
        title: '10. What this report is not',
        statements: [
          'This report is not a certified measurement.',
          'This report is not an engineering determination.',
          'This report is not an insurance claim decision.',
          'This report is not a code compliance certification.',
          'This report is not a final estimate or price.',
          'This report is a set of observations, sources, and calculations for the property owner. It is based on on-site photos and the sources named in the report. Its purpose is education.',
        ],
      },
      {
        id: 'questions',
        title: '11. Questions',
        statements: [
          'Unknown. No homeowner question is recorded for this report.',
          'Questions about money or insurance decisions must be answered by a human.',
        ],
      },
      {
        id: 'signatures',
        title: '12. Signatures',
        statements: [
          `Technician: ${row.technician_name || 'Unknown'}. License / registration: ${row.technician_license || 'Unknown'}. Signature: ${row.technician_signature ? 'Captured.' : 'Unknown.'}`,
          `Owner / Manager approval: ${row.manager_approval_name || 'Unknown'}. Signature: ${row.manager_approval_signature ? 'Captured.' : 'Unknown.'} Approved on: ${row.manager_approved_at || 'Unknown'}.`,
          'Report version: v1.0.',
          `Report ID: ${reportId}.`,
        ],
      },
    ],
    footer: {
      motto: 'We educate. You decide.',
      text: 'This report was prepared from on-site photos and the sources named in the report. Every claim can be checked.',
      company: 'Unknown',
      phone: 'Unknown',
    },
    sourceEvidence: { inspectionId: row.inspection_id, photoIds: sourcePhotoIds, photoCount: sourcePhotoIds.length },
    technicianApproval: { accountId: row.approved_by, approvedAt: row.approved_at },
  }
  if (getGoldenReportContractErrors(fullReport).length > 0) {
    return jsonError('The report did not pass the Golden Report rules and was not saved.', 500)
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
  if (updateError || !updated) return jsonError('The report could not be saved.', 502)

  if (row.lead_id) {
    await supabase
      .from('leads')
      .update({ status: 'report_pending', updated_at: generatedAt })
      .eq('id', row.lead_id)
      .eq('workspace_id', workspaceId)
  }

  return NextResponse.json({ workflow: updated, report: fullReport, warning: 'This report is a draft. It is not ready for homeowner delivery until unknown facts are resolved, a technician signs it, and an owner or manager approves it.' })
}
