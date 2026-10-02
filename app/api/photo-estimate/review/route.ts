import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

type PhotoReview = { photoId: string; usability: 'usable' | 'not_usable'; coverage: 'complete' | 'partial' | 'not_visible'; notes: string | null; reviewedBy: string; reviewedAt: string }
type ReviewBody = {
  action?: 'photo_review' | 'manager_approve'
  workflowId?: string
  photoId?: string
  usability?: PhotoReview['usability']
  coverage?: PhotoReview['coverage']
  notes?: string
  managerName?: string
  managerSignature?: string
}
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }) }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function isSignature(value: unknown): value is string { return typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{1,240000}$/.test(value) }

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return error('Authentication required.', 401)
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!isUuid(workspaceId)) return error('Workspace required.', 403)
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError || !isAdmin) return error('Workspace administrator access is required for Golden Report review.', 403)

  const parsed = await readJson(request, 512 * 1024)
  if ('error' in parsed) return error(parsed.error, parsed.status)
  const body = parsed.body as ReviewBody
  if (!isUuid(body.workflowId)) return error('A valid workflowId is required.', 400)
  if (body.action !== 'photo_review' && body.action !== 'manager_approve') return error('Choose photo_review or manager_approve.', 400)

  const { data: workflow, error: workflowError } = await supabase
    .from('photo_estimate_workflows')
    .select('id,workspace_id,status,report,source_photo_ids,photo_reviews,technician_name,technician_license,technician_signature,manager_approved_by,manager_approved_at')
    .eq('id', body.workflowId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (workflowError) return error('The workflow could not be loaded.', 503)
  if (!workflow) return error('Workflow not found.', 404)

  const now = new Date().toISOString()
  const reviews = Array.isArray(workflow.photo_reviews) ? workflow.photo_reviews.filter(isRecord) as PhotoReview[] : []
  const photoIds = Array.isArray(workflow.source_photo_ids) ? workflow.source_photo_ids : []

  if (body.action === 'photo_review') {
    if (!isUuid(body.photoId)) return error('A valid photoId is required.', 400)
    if (!photoIds.includes(body.photoId)) return error('The photo is not part of this workflow.', 400)
    if (body.usability !== 'usable' && body.usability !== 'not_usable') return error('Choose a photo usability decision.', 400)
    if (body.coverage !== 'complete' && body.coverage !== 'partial' && body.coverage !== 'not_visible') return error('Choose a photo coverage decision.', 400)
    if ((body.notes?.length ?? 0) > 1000) return error('Photo review notes are too long.', 400)
    const nextReview: PhotoReview = { photoId: body.photoId, usability: body.usability, coverage: body.coverage, notes: body.notes?.trim() || null, reviewedBy: user.id, reviewedAt: now }
    const nextReviews = [...reviews.filter((review) => review.photoId !== body.photoId), nextReview]
    const report = isRecord(workflow.report) ? workflow.report : {}
    const reviewControls = isRecord(report.reviewControls) ? report.reviewControls : {}
    const { data: updated, error: updateError } = await supabase.from('photo_estimate_workflows')
      .update({ photo_reviews: nextReviews, report: { ...report, reviewControls: { ...reviewControls, photoReviews: nextReviews } }, updated_at: now })
      .eq('id', body.workflowId).eq('workspace_id', workspaceId)
      .select('id,status,photo_reviews,report,updated_at').single()
    if (updateError) return error('Could not save the photo review.', 502)
    return NextResponse.json({ workflow: updated, action: body.action })
  }

  if (!workflow.technician_name || !workflow.technician_license || !isSignature(workflow.technician_signature)) {
    return error('Technician name, license, and signature are required before manager approval.', 409)
  }
  if (photoIds.length < 1 || photoIds.some((id: unknown) => !reviews.some((review) => review.photoId === id))) {
    return error('Every source photo requires a usability and coverage review before manager approval.', 409)
  }
  const managerName = body.managerName?.trim() ?? ''
  if (!managerName || managerName.length > 160) return error('Enter the owner or manager name.', 400)
  if (!isSignature(body.managerSignature)) return error('Capture the owner or manager signature before approval.', 400)

  const managerApproval = { approvedBy: user.id, approvedAt: now, managerName, managerSignature: body.managerSignature }
  const report = isRecord(workflow.report) ? workflow.report : {}
  const reviewControls = isRecord(report.reviewControls) ? report.reviewControls : {}
  const nextReport = { ...report, reviewControls: { ...reviewControls, managerApproval }, managerApproval }
  const { data: updated, error: updateError } = await supabase.from('photo_estimate_workflows')
    .update({ manager_approved_by: user.id, manager_approved_at: now, manager_approval_name: managerName, manager_approval_signature: body.managerSignature, report: nextReport, updated_at: now })
    .eq('id', body.workflowId).eq('workspace_id', workspaceId)
    .select('id,status,photo_reviews,manager_approved_by,manager_approved_at,manager_approval_name,report,updated_at').single()
  if (updateError) return error('Could not save manager approval.', 502)
  return NextResponse.json({ workflow: updated, action: body.action, warning: 'Manager approval is recorded. The report remains a controlled draft until delivery policy permits release.' })
}
