import { timingSafeEqual } from 'node:crypto'

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Private break-glass gate. OWNER_ENTER_SECRET must be set server-side and
 * match the request key (query `key` or header `x-roof-os-enter`).
 */
export function assertOwnerEnterAuthorized(args: {
  providedKey: string | null
}): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.OWNER_ENTER_SECRET?.trim()
  if (!expected || expected.length < 16) {
    return { ok: false, reason: 'enter_locked' }
  }
  const provided = args.providedKey?.trim() || ''
  if (!provided || !secretsEqual(provided, expected)) {
    return { ok: false, reason: 'enter_forbidden' }
  }
  return { ok: true }
}
