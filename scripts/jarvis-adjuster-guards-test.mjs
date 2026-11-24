import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeE164, isQuietHours, hasValidConsent, canSendNow, missingPrice, assertNoFabrication } from '../lib/jarvis/guards.ts'
import { isWithinQuietHours, normalizeStrictE164 } from '../lib/outbound-policy.ts'
import { JARVIS_JOB_TYPES, JARVIS_LOGICAL_AGENT_COUNT } from '../lib/jarvis/types.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Strict NANP: area and exchange codes cannot start with 0 or 1.
assert.equal(normalizeE164('+15552345678'), '+15552345678')
assert.equal(normalizeE164('(555) 234-5678'), '+15552345678')
assert.equal(normalizeE164('5552345678'), '+15552345678')
assert.equal(normalizeE164('+15551234567'), null, 'exchange code 123 starts with 1: invalid')
assert.equal(normalizeE164('+11234567890'), null, 'area code 123 starts with 1: invalid')
assert.equal(normalizeE164('+1222333'), null)
assert.equal(normalizeE164(''), null)
assert.equal(normalizeE164(null), null)

// Quiet hours are 08:00-20:00 inclusive of 08:00, exclusive of 20:00, in the claim timezone.
assert.equal(isQuietHours(new Date('2026-11-24T07:59:00Z'), 'UTC'), true)
assert.equal(isQuietHours(new Date('2026-11-24T08:00:00Z'), 'UTC'), false)
assert.equal(isQuietHours(new Date('2026-11-24T19:59:59Z'), 'UTC'), false)
assert.equal(isQuietHours(new Date('2026-11-24T20:00:00Z'), 'UTC'), true)

// One hour rule: JARVIS is the complement of the canonical outbound policy,
// including midnight (Intl renders en-US hour 24) and invalid timezones.
for (const instant of [
  '2026-11-24T00:00:00Z', '2026-11-24T07:59:00Z', '2026-11-24T12:00:00Z', '2026-11-24T20:00:00Z',
]) {
  const date = new Date(instant)
  assert.equal(isQuietHours(date, 'UTC'), !isWithinQuietHours(date, 'UTC'))
}
for (const instant of ['2026-11-24T03:00:00Z', '2026-11-24T12:00:00Z', '2026-11-24T23:00:00Z']) {
  const date = new Date(instant)
  assert.equal(isQuietHours(date, 'Not/AZone'), !isWithinQuietHours(date), 'invalid timezone falls back to the same canonical rule')
}
assert.equal(normalizeE164('(415) 555-2671'), normalizeStrictE164('(415) 555-2671'))

const consent = { smsConsent: true, emailConsent: true, optedOutAt: null }
assert.equal(hasValidConsent(consent, 'sms'), true)
assert.equal(hasValidConsent(consent, 'email'), true)
assert.equal(hasValidConsent({ ...consent, optedOutAt: '2026-11-01T00:00:00Z' }, 'sms'), false)
assert.equal(hasValidConsent({ ...consent, smsConsent: false }, 'sms'), false)
assert.equal(hasValidConsent(consent, 'voice'), false, 'voice requires its own recorded consent')

assert.equal(canSendNow({ channel: 'sms', contact: '+15552345678', consent, now: new Date('2026-11-24T12:00:00Z'), timeZone: 'UTC' }), true)
assert.equal(canSendNow({ channel: 'sms', contact: '+15551234567', consent, now: new Date('2026-11-24T12:00:00Z'), timeZone: 'UTC' }), false)
assert.equal(canSendNow({ channel: 'sms', contact: '+15552345678', consent, now: new Date('2026-11-24T20:00:00Z'), timeZone: 'UTC' }), false)

// Missing carrier price is null, never zero; unknown measurements are gaps, not numbers.
assert.equal(missingPrice(undefined), null)
assert.equal(missingPrice(null), null)
assert.equal(missingPrice(''), null)
assert.equal(missingPrice('unknown'), null)
assert.equal(missingPrice(0), 0, 'an explicitly reported zero is a real value')
assert.equal(missingPrice(1250), 1250)

const cleanFacts = { measurements: [], prices: [], coverage: [], xactimateCodes: [], scopeGaps: ['attic access not documented'] }
assert.deepEqual(assertNoFabrication(cleanFacts), [])
const dirty = assertNoFabrication({ ...cleanFacts, prices: [{ amount: null, provenance: 'unknown' }] })
assert.equal(dirty.length, 1, 'a null price with unknown provenance is a gap, not a fabricated value')
assert.deepEqual(assertNoFabrication({ ...cleanFacts, prices: [{ amount: 500, provenance: 'unknown' }] }), ['price_without_provenance'])

assert.equal(JARVIS_LOGICAL_AGENT_COUNT, 15, 'no 16th agent')
assert.equal(JARVIS_JOB_TYPES.length, 6)
assert.deepEqual([...JARVIS_JOB_TYPES].sort(), [...JARVIS_JOB_TYPES].sort())

// Schema guards.
const migration = read('supabase/migrations/114_jarvis_adjuster.sql')
for (const fragment of [
  'create table if not exists public.jarvis_jobs',
  'payload_hash text not null',
  'idempotency_key text not null',
  'create table if not exists public.adjuster_messages',
  'workspace_id uuid not null',
  'adjuster_enabled boolean',
  'alter table public.jarvis_jobs enable row level security',
]) assert.ok(migration.includes(fragment), `migration must contain ${fragment}`)

console.log('jarvis-adjuster guards contract passed')
