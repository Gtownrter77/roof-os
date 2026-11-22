/** Pure staleness decision for agent-runs recovery.
 *
 * No runtime imports: the worker and its gate share the same bounded window,
 * and a live run is never requeued while it is still making progress. */

export const AGENT_RUN_STALE_AFTER_MS = 15 * 60 * 1000

/** A run with no start timestamp, an unparsable timestamp, or a start older
 * than the bounded window is orphaned and safe to re-claim. */
export function isStaleRunning(
  startedAt: string | null | undefined,
  nowMs: number,
  staleAfterMs = AGENT_RUN_STALE_AFTER_MS
): boolean {
  if (!startedAt) return true
  const started = Date.parse(startedAt)
  return !Number.isFinite(started) || nowMs - started >= staleAfterMs
}
