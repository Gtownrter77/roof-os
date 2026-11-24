// Pure consent resolution for the JARVIS worker. Mirrors the canonical
// receptionist rule: any revocation for the same contact and channel wins over
// older grants, expired grants are ignored, and an unparseable contact grants
// nothing. The worker uses this before canSendNow() sees the result.

import { isValidEmail, normalizeE164 } from '../guards.ts'
import type { Channel, ConsentRecord } from '../types.ts'

export type ConsentRow = {
  channel?: string | null
  state?: string | null
  phone?: string | null
  captured_at?: string | null
  expires_at?: string | null
}

function normalizedContact(channel: Channel, contact: string): string | null {
  if (channel === 'email') return isValidEmail(contact)
  return normalizeE164(contact)
}

function rowMatches(row: ConsentRow, channel: Channel, contact: string | null): boolean {
  if (contact === null || typeof row.phone !== 'string') return false
  if (channel === 'email') return row.phone.trim().toLowerCase() === contact
  return normalizeE164(row.phone) === contact
}

function capturedAt(row: ConsentRow): number {
  const parsed = row.captured_at ? Date.parse(row.captured_at) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

function notExpired(row: ConsentRow, now: Date): boolean {
  if (!row.expires_at) return true
  const expires = Date.parse(row.expires_at)
  return Number.isFinite(expires) && expires > now.getTime()
}

export function resolveConsent(
  rows: readonly ConsentRow[],
  channel: Channel,
  contact: string,
  now: Date,
): ConsentRecord {
  const contactKey = normalizedContact(channel, contact)
  const scoped = rows.filter((row) => row.channel === channel && rowMatches(row, channel, contactKey))
  const revoked = scoped
    .filter((row) => row.state === 'revoked')
    .sort((a, b) => capturedAt(b) - capturedAt(a))
  const granted = scoped.some((row) => row.state === 'granted' && notExpired(row, now))
  const allowed = granted && revoked.length === 0

  return {
    smsConsent: channel === 'sms' && allowed,
    emailConsent: channel === 'email' && allowed,
    voiceConsent: channel === 'voice' && allowed,
    // Never invent a revocation timestamp; the false channel flag is the gate.
    optedOutAt: revoked[0]?.captured_at ?? null,
  }
}
