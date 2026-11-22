/** Lockout sequencing helpers. Kept pure so the step derivation can be tested
 * independently of Supabase; the route adds an optimistic concurrency guard. */

type LockEntry = {
  step: string
  layer: string
  user_id: string
  tagged_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function nextLockStep(tags: unknown, sequence: readonly string[]): string | null {
  if (!Array.isArray(tags)) return null
  const recorded = tags.map((tag) => (isRecord(tag) ? tag.step : null))
  if (recorded.length > sequence.length) return null
  if (recorded.some((step, index) => step !== sequence[index])) return null
  return sequence[recorded.length] ?? null
}

export function nextLockEntry(
  tags: unknown,
  sequence: readonly string[],
  layer: string,
  userId: string,
  nowIso: string
): LockEntry | null {
  const step = nextLockStep(tags, sequence)
  if (!step || !Number.isFinite(Date.parse(nowIso)) || !userId) return null
  return { step, layer, user_id: userId, tagged_at: nowIso }
}
