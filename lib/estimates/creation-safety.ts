/** Safe defaults for estimate creation. These helpers are pure so the approval
 * metadata and failure contract can be tested without a hosted database. */

export type CreationApprovalFields = {
  approved_by: string | null
  approved_at: string | null
  approval_tags: Array<{ step: 'self'; layer: 'admin'; user_id: string; tagged_at: string }>
}

export function creationApprovalFields(
  status: string,
  userId: string,
  nowIso: string
): CreationApprovalFields | null {
  if (!userId || !Number.isFinite(Date.parse(nowIso))) return null
  if (status !== 'approved') return { approved_by: null, approved_at: null, approval_tags: [] }
  return {
    approved_by: userId,
    approved_at: nowIso,
    approval_tags: [{ step: 'self', layer: 'admin', user_id: userId, tagged_at: nowIso }],
  }
}

export function rollbackFailure(
  estimateId: string,
  deleteError: { message: string } | null | undefined,
  lineItemError: string
): { error: string; detail: string } {
  if (!deleteError) return { error: 'Could not create estimate line items.', detail: lineItemError }
  return {
    error: 'Could not create estimate line items; the empty estimate could not be removed automatically and needs operator cleanup.',
    detail: `${lineItemError}; orphan estimate ${estimateId}: ${deleteError.message}`,
  }
}
