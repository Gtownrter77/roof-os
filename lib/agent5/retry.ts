/**
 * Persistence retry policy for Agent 5 draft writes.
 *
 * Only database errors that are safe to retry are retryable. A unique
 * violation is handled separately as an idempotency replay or conflict, so it
 * is never retried here. Nothing in this module sleeps, loops, or calls out.
 */

export interface RetryDecision {
  retryable: boolean
  retry_after_seconds: number | null
  reason: string
}

const RETRYABLE_CODES = new Map<string, string>([
  ['40001', 'serialization_failure'],
  ['40P01', 'deadlock_detected'],
  ['53300', 'too_many_connections'],
  ['57P03', 'cannot_connect_now'],
  ['08000', 'connection_exception'],
  ['08006', 'connection_failure'],
])

const BASE_DELAY_SECONDS = 1
const MAX_DELAY_SECONDS = 8

/** Deterministic bounded backoff: 1, 2, 4, 8, 8, ... */
export function retryDelaySeconds(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0
  return Math.min(MAX_DELAY_SECONDS, BASE_DELAY_SECONDS * 2 ** Math.min(safeAttempt, 8))
}

export function classifyPersistenceError(code: string | null | undefined, attempt = 0): RetryDecision {
  if (typeof code === 'string' && RETRYABLE_CODES.has(code)) {
    return {
      retryable: true,
      retry_after_seconds: retryDelaySeconds(attempt),
      reason: RETRYABLE_CODES.get(code)!,
    }
  }
  if (code === '23505') {
    return { retryable: false, retry_after_seconds: null, reason: 'unique_violation' }
  }
  return { retryable: false, retry_after_seconds: null, reason: 'not_retryable' }
}
