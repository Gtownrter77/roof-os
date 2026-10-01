const DEFAULT_COOLDOWN_SECONDS = 60
const MAX_COOLDOWN_SECONDS = 300

function boundedSeconds(value: unknown): number | null {
  const seconds = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : NaN
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.max(1, Math.min(MAX_COOLDOWN_SECONDS, Math.ceil(seconds)))
}

/** Return a bounded retry delay only when an auth error indicates rate limiting. */
export function authCooldownSeconds(error: unknown): number {
  if (!error || typeof error !== 'object') return 0
  const details = error as {
    status?: unknown
    code?: unknown
    message?: unknown
    retryAfter?: unknown
    retry_after?: unknown
    headers?: { get?: (name: string) => string | null }
  }
  const status = details.status
  const code = typeof details.code === 'string' ? details.code : ''
  const message = typeof details.message === 'string' ? details.message : ''
  const rateLimitSignal = status === 429 || /rate[\s_-]*limit|too many|over_(?:email|request)_rate_limit|\b429\b/i.test(`${code} ${message}`)
  if (!rateLimitSignal) return 0

  const header = details.headers?.get?.('retry-after')
  const retryAfter = boundedSeconds(details.retryAfter)
    ?? boundedSeconds(details.retry_after)
    ?? boundedSeconds(header)
  if (retryAfter !== null) return retryAfter

  const messageDelay = message.match(/(?:retry\s+after|after|in|wait)\s+(\d{1,4})\s*(?:seconds?|secs?|s)\b/i)
  return boundedSeconds(messageDelay?.[1]) ?? DEFAULT_COOLDOWN_SECONDS
}
