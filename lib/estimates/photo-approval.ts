/**
 * A manager approval is bound to the technician measurements and photo set
 * that existed when it was captured. Any later change to either must invalidate
 * it; a non-empty set of approval columns is not proof of a current approval.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Remove every approval artefact tied to a superseded measurement or photo
 * set, while keeping the technician verification, photo reviews, and the
 * canonical `approved_for_customer_packet` gate status.
 */
export function clearStaleManagerApproval(report: unknown): Record<string, unknown> {
  const source = isRecord(report) ? report : {}
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === 'managerApproval' || key === 'fullReport' || key === 'fullReportGeneratedAt') continue
    next[key] = value
  }
  const reviewControls = isRecord(next.reviewControls) ? { ...next.reviewControls } : {}
  delete reviewControls.managerApproval
  next.reviewControls = reviewControls
  next.status = 'approved_for_customer_packet'
  return next
}

/**
 * True only when the workflow carries a well-formed, unexpired manager
 * approval captured after the current technician verification.
 */
export function hasValidManagerApproval(
  workflow: unknown,
  isSignature: (value: unknown) => boolean
): boolean {
  if (!isRecord(workflow)) return false
  if (typeof workflow.manager_approved_by !== 'string' || !UUID.test(workflow.manager_approved_by)) return false
  const approvedAt = validTimestamp(workflow.manager_approved_at)
  if (approvedAt === null) return false
  if (typeof workflow.manager_approval_name !== 'string' || !workflow.manager_approval_name.trim()) return false
  if (!isSignature(workflow.manager_approval_signature)) return false

  if (!isRecord(workflow.report)) return false
  if (workflow.report.status !== 'approved_for_customer_packet') return false
  const verification = workflow.report.technicianVerification
  if (isRecord(verification)) {
    const verifiedAt = validTimestamp(verification.verifiedAt)
    if (verifiedAt !== null && verifiedAt > approvedAt) return false
  }
  return true
}
