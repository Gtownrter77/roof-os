import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizeStrictE164 } from '../lib/outbound-policy.ts'

assert.equal(normalizeStrictE164('+14155552671'), '+14155552671')
assert.equal(normalizeStrictE164('4155552671'), '+14155552671')
assert.equal(normalizeStrictE164('1 (415) 555-2671'), '+14155552671')

// NANP area codes and exchange codes must both begin with 2–9.
assert.equal(normalizeStrictE164('1155552671'), null)
assert.equal(normalizeStrictE164('4150552671'), null)
assert.equal(normalizeStrictE164('415555267'), null)
assert.equal(normalizeStrictE164('+441234567890'), null)

const cron = await readFile(new URL('../app/api/cron/receptionist-followups/route.ts', import.meta.url), 'utf8')
const validation = cron.indexOf('if (!phone)')
const providerCall = cron.indexOf('client.calls.create')
assert.ok(validation >= 0, 'follow-up cron must reject invalid strict phone numbers')
assert.ok(validation < providerCall, 'phone validation must happen before any Twilio call')
assert.ok(cron.includes("event_type: 'follow_up.invalid_phone'"), 'invalid phone attempts must be auditable')
assert.ok(cron.includes(".update({ status: 'failed' })"), 'invalid phone attempts must leave the queue instead of retrying indefinitely')
assert.ok(!cron.includes('normalizeStrictE164(attempt.phone) ?? attempt.phone'), 'strict mode must never fall back to the raw invalid number')

console.log('outbound-policy-test: PASS')
