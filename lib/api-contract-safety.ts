/** Pure guards for API payload unwrapping and action-executor principal checks. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** readJson resolves to `{ body }`. Extract the real payload; never treat the
 * wrapper as the body. */
export function teamSequencePayload(
  parsed: unknown
): { memberId: string; sequence: string[] } | null {
  if (!isRecord(parsed) || 'error' in parsed) return null
  if (!isRecord(parsed.body)) return null
  const memberId = parsed.body.memberId
  const sequence = parsed.body.sequence
  if (typeof memberId !== 'string' || !memberId || !Array.isArray(sequence)) return null
  return { memberId, sequence: sequence.filter((step): step is string => typeof step === 'string') }
}

/** Every principal id an approved action will write must exist in the supplied
 * set of workspace members for the action's workspace. */
export function principalsInWorkspace(
  principalIds: Array<string | null | undefined>,
  memberIds: Set<string>
): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const id of principalIds) {
    if (!id || !memberIds.has(id)) missing.push(id ?? '')
  }
  return { ok: missing.length === 0, missing }
}
