/**
 * Agent 5 request idempotency — server-side only.
 *
 * A caller may send an `Idempotency-Key` with a draft-creation request. The key
 * is scoped to one workspace. Replaying the same key with the same payload
 * returns the stored draft; replaying it with a different payload is a
 * conflict, not a silent second revision.
 */
import { createHash } from 'node:crypto'

export const IDEMPOTENCY_KEY_MIN_LENGTH = 16
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128

const KEY_PATTERN = /^[A-Za-z0-9._:-]+$/

export interface IdempotencyKeyResult {
  key: string | null
  error: string | null
}

export function normalizeIdempotencyKey(raw: string | null | undefined): IdempotencyKeyResult {
  if (raw === null || raw === undefined) return { key: null, error: null }
  const key = raw.trim()
  if (key.length === 0) return { key: null, error: 'Idempotency-Key must not be empty.' }
  if (key.length < IDEMPOTENCY_KEY_MIN_LENGTH || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return {
      key: null,
      error: `Idempotency-Key must be between ${IDEMPOTENCY_KEY_MIN_LENGTH} and ${IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
    }
  }
  if (!KEY_PATTERN.test(key)) {
    return { key: null, error: 'Idempotency-Key may contain only letters, digits, dot, underscore, colon, and hyphen.' }
  }
  return { key, error: null }
}

/** Stable JSON: object keys sorted, undefined omitted, arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

export interface IdempotencyPayload {
  document_id: string
  carrier_rows?: unknown
  contractor_rows?: unknown
  docling?: unknown
  measurements?: unknown
  previous_draft_id?: unknown
}

/**
 * Fingerprint of the request fields that change the persisted packet. It is
 * intentionally independent of object key order, so a client retry that
 * serializes the same request differently still matches.
 */
export function fingerprintRequest(payload: IdempotencyPayload): string {
  const canonical = canonicalJson({
    document_id: payload.document_id,
    carrier_rows: payload.carrier_rows,
    contractor_rows: payload.contractor_rows,
    docling: payload.docling,
    measurements: payload.measurements,
    previous_draft_id: payload.previous_draft_id,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

export function fingerprintsMatch(left: unknown, right: unknown): boolean {
  return typeof left === 'string' && typeof right === 'string' && left.length === right.length && left === right
}
