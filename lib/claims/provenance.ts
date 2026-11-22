import { createHash } from 'node:crypto'

const STORAGE_PREFIX = '/storage/v1/object/sign/'

/**
 * Stable idempotency key derived from the signed storage object PATH, never
 * from the rotating URL token. Namespaced per provider so two providers can
 * legitimately import the same document independently.
 */
export function stableExternalDocumentId(provider: string, sourceUrl: unknown): string | null {
  if (typeof sourceUrl !== 'string' || !sourceUrl || !provider) return null
  try {
    const url = new URL(sourceUrl)
    if (url.protocol !== 'https:' || !url.pathname.startsWith(STORAGE_PREFIX)) return null
    const objectPath = url.pathname.slice(STORAGE_PREFIX.length)
    if (!objectPath) return null
    return `${provider}:${createHash('sha256').update(objectPath).digest('hex')}`
  } catch {
    return null
  }
}

/**
 * Only an unfinished or failed import may be reset and retried under the same
 * stable key. Terminal states (including 'processing' and 'ready_for_review')
 * must never be overwritten by a re-submission.
 */
export function isRetryableImportStatus(value: unknown): value is 'received' | 'failed' {
  return value === 'received' || value === 'failed'
}

/** A 64-hex digest of document BYTES, as produced by the claims worker. */
export function isContentSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

/** Fingerprint of the signed URI itself — metadata, not a content hash. */
export function sourceUriFingerprint(sourceUrl: string): string {
  return createHash('sha256').update(sourceUrl).digest('hex')
}
