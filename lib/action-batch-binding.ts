/** Pure approval-binding decision shared by the batch executor and its gate.
 *
 * Low-risk actions never required an approval token, so an all-low-risk batch
 * is legitimately inserted with a NULL approval_token_hash. Only batches that
 * contain at least one approval-required action need the signed binding. */

export function needsApprovalTokenHash(actions: ReadonlyArray<{ requires_approval: boolean }>): boolean {
  return actions.some((action) => action.requires_approval)
}
