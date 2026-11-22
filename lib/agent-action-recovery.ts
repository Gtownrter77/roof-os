/** Pure decisions for action-batch failure and staleness recovery.
 *
 * No runtime imports: the worker and its gates can share these rules without
 * pulling a Supabase client or a framework into a source-contract test. */

export type BatchRejection = { status: 'expired' | 'failed'; message: string }

/** A guard failure on an approved batch must end the row's life, not leave it
 * selected by every subsequent cron tick. */
export function approvedBatchRejection(reason: string): BatchRejection {
  if (reason === 'expired') return { status: 'expired', message: 'Action batch has expired' }
  return { status: 'failed', message: 'Approved batch no longer matches its signed payload' }
}

/** A claimed batch with no start timestamp, an unparsable timestamp, or a start
 * older than the bounded window is safe to replay (task writes are keyed by
 * `automation_key`). */
export function isStaleExecuting(startedAt: string | null, nowMs: number, staleAfterMs: number): boolean {
  if (!startedAt) return true
  const started = Date.parse(startedAt)
  return !Number.isFinite(started) || nowMs - started >= staleAfterMs
}

/** Result of an `.update(...).select('id')` ledger write. `expectRows` is true
 * where the caller requires at least one row to have changed. */
export function statusWriteSucceeded(
  result: { error?: { message?: string } | null; data?: unknown[] | null } | null | undefined,
  expectRows: boolean
): { ok: boolean; reason?: string } {
  if (result?.error) return { ok: false, reason: result.error.message ?? 'status write failed' }
  if (expectRows && (!result || !Array.isArray(result.data) || result.data.length === 0)) {
    return { ok: false, reason: 'status write affected no rows' }
  }
  return { ok: true }
}
