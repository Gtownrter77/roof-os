import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paymentLinkReuse, stripeIdempotencyKey } from '../lib/billing/payment-link-safety.ts'

const NOW = '2026-11-22T12:00:00.000Z'
const link = (overrides = {}) => ({
  id: 'pl-1', invoice_id: 'inv-1', url: 'https://pay.example/1', status: 'created',
  provider_link_id: 'cs_1', amount_cents: 1000, currency: 'usd', expires_at: null, ...overrides,
})

assert.equal(paymentLinkReuse(null, 'inv-1', NOW), 'none')
assert.equal(paymentLinkReuse(link(), 'inv-1', NOW), 'reuse', 'the same invoice may reuse its link')
assert.equal(paymentLinkReuse(link(), 'inv-2', NOW), 'mismatch', 'a key must not return another invoice\'s link')
assert.equal(paymentLinkReuse(link({ expires_at: '2026-11-22T11:00:00.000Z' }), 'inv-1', NOW), 'expired')
assert.equal(paymentLinkReuse(link({ expires_at: '2026-11-23T11:00:00.000Z' }), 'inv-1', NOW), 'reuse')

// REVIEWER MEDIUM 50: the Stripe-side idempotency key must be namespaced by
// workspace + invoice so a crash between Stripe session creation and the
// ledger insert cannot let a different invoice consume the cached session.
// FINDING 70: the suffix must be a cryptographic SHA-256 digest, not a 32-bit
// FNV-1a hash whose collisions can bind an unrelated client key to a cached session.
const { webcrypto } = await import('node:crypto')
const raw = 'ws-1:inv-1:client-key'
const expectedDigest = Array.from(
  new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))),
  (byte) => byte.toString(16).padStart(2, '0')
).join('')
const k1 = await stripeIdempotencyKey('ws-1', 'inv-1', 'client-key')
assert.equal(k1, await stripeIdempotencyKey('ws-1', 'inv-1', 'client-key'), 'key must be deterministic')
assert.notEqual(k1, await stripeIdempotencyKey('ws-1', 'inv-2', 'client-key'), 'different invoice must get a different Stripe key')
assert.notEqual(k1, await stripeIdempotencyKey('ws-2', 'inv-1', 'client-key'), 'different workspace must get a different Stripe key')
assert.ok(k1.length <= 255 && k1.startsWith('roofos:'), 'namespaced key must be bounded and tagged')
assert.ok(k1.includes(expectedDigest), 'idempotency suffix must be the SHA-256 digest of workspace:invoice:clientKey')
assert.equal(expectedDigest.length, 64, 'SHA-256 digest must be 64 hex characters')

const route = readFileSync(new URL('../app/api/receptionist/stripe/payment-link/route.ts', import.meta.url), 'utf8')
assert.match(route, /paymentLinkReuse\(/, 'route must decide reuse via the shared helper')
assert.match(route, /'mismatch'/, 'a mismatched invoice must be rejected')
assert.match(route, /23505/, 'a unique-violation on insert must be handled as an idempotent replay')
assert.match(route, /invoice_id/, 'the reuse lookup must prove invoice binding')
assert.match(route, /await stripeIdempotencyKey\(workspaceId,\s*invoice\.id,\s*body\.idempotencyKey\)/, 'the Stripe call must await the namespaced SHA-256 key')
assert.ok(!/\{\s*idempotencyKey:\s*body\.idempotencyKey\s*\}/.test(route), 'the raw client key must not be passed to Stripe')

console.log('payment-link-idempotency-test: PASS (reuse bound to invoice; expired/mismatch distinct; unique-violation replay)')
