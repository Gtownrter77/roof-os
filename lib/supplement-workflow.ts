/** Pure transition rules for the legacy admin supplement PATCH.
 *
 * The guarded review route only moves a `ready_for_review` draft to a final
 * state. This table gives the legacy route the same discipline: approval is
 * final, and only a rejected draft may be reopened for another review. */

const ALLOWED_TRANSITIONS: Readonly<Record<string, ReadonlyArray<string>>> = {
  needs_review: ['approved', 'rejected'],
  rejected: ['needs_review'],
}

export function allowedSupplementTransition(current: string | null | undefined, target: string): boolean {
  if (!current) return false
  return (ALLOWED_TRANSITIONS[current] ?? []).includes(target)
}
