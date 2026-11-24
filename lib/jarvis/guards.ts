// Pure legal/safety guards for the in-house adjuster. These functions are
// deterministic and dependency-free so every send decision can be tested and
// replayed without a live provider.

import type { Channel, ClaimFacts, ConsentRecord } from './types.ts'

const NANP_E164 = /^\+1[2-9]\d{2}[2-9]\d{6}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UNKNOWN_PRICE = new Set(['', 'unknown', 'n/a', 'na', 'null', 'none', '-'])

/**
 * Strict NANP E.164 normalization. Area and exchange codes may not start with
 * 0 or 1. Returns null when the input cannot be proven valid — never a guess.
 */
export function normalizeE164(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  const stripped = trimmed.replace(/[\s().-]/g, '')
  let candidate: string
  if (stripped.startsWith('+')) candidate = stripped
  else if (/^1\d{10}$/.test(stripped)) candidate = `+${stripped}`
  else if (/^\d{10}$/.test(stripped)) candidate = `+1${stripped}`
  else return null
  return NANP_E164.test(candidate) ? candidate : null
}

export function isValidEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim().toLowerCase()
  return EMAIL.test(value) ? value : null
}

/**
 * TCPA contact window is 08:00-20:00 local. Returns true when the instant is
 * OUTSIDE that window (i.e. quiet hours). Hour boundaries are evaluated in the
 * claim's IANA timezone with UTC as the safe fallback.
 */
export function isWithinQuietHours(now: Date, timeZone = 'UTC'): boolean {
  let hour: number
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', hour12: false, timeZone,
    }).formatToParts(now)
    const raw = parts.find((part) => part.type === 'hour')?.value ?? '24'
    hour = Number(raw) % 24
  } catch {
    hour = now.getUTCHours()
  }
  return hour < 8 || hour >= 20
}

export function hasValidConsent(consent: ConsentRecord | null | undefined, channel: Channel): boolean {
  if (!consent || consent.optedOutAt) return false
  if (channel === 'sms') return consent.smsConsent === true
  if (channel === 'email') return consent.emailConsent === true
  return consent.voiceConsent === true
}

/** One gate for every outbound message. No send path may bypass it. */
export function canSendNow(input: {
  channel: Channel
  contact: string
  consent: ConsentRecord | null | undefined
  now: Date
  timeZone?: string
}): boolean {
  if (!hasValidConsent(input.consent, input.channel)) return false
  if (isWithinQuietHours(input.now, input.timeZone ?? 'UTC')) return false
  if (input.channel === 'email') return isValidEmail(input.contact) !== null
  return normalizeE164(input.contact) !== null
}

/** Missing carrier price is null. An explicitly reported zero stays a zero. */
export function missingPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && UNKNOWN_PRICE.has(value.trim().toLowerCase())) return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

/**
 * Facts may only contain values with provenance. Missing values become scope
 * gaps; they are never invented or coerced to zero.
 */
export function assertNoFabrication(facts: ClaimFacts): string[] {
  const gaps: string[] = []
  for (const measurement of facts.measurements ?? []) {
    if (!Number.isFinite(measurement.value)) gaps.push('measurement_not_numeric')
    if (!measurement.provenance || measurement.provenance === 'unknown') gaps.push('measurement_without_provenance')
  }
  for (const price of facts.prices ?? []) {
    if (price.amount === null || price.amount === undefined) gaps.push('price_missing')
    else if (!price.provenance || price.provenance === 'unknown') gaps.push('price_without_provenance')
  }
  for (const coverage of facts.coverage ?? []) {
    if (!coverage.description?.trim()) gaps.push('coverage_empty')
    if (!coverage.provenance || coverage.provenance === 'unknown') gaps.push('coverage_without_provenance')
  }
  for (const code of facts.xactimateCodes ?? []) {
    if (!code.code?.trim()) gaps.push('xactimate_code_empty')
    if (!code.provenance || code.provenance === 'unknown') gaps.push('xactimate_code_without_provenance')
  }
  return gaps
}
