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
const k1 = stripeIdempotencyKey('ws-1', 'inv-1', 'client-key')
assert.equal(k1, stripeIdempotencyKey('ws-1', 'inv-1', 'client-key'), 'key must be deterministic')
assert.notEqual(k1, stripeIdempotencyKey('ws-1', 'inv-2', 'client-key'), 'different invoice must get a different Stripe key')
assert.notEqual(k1, stripeIdempotencyKey('ws-2', 'inv-1', 'client-key'), 'different workspace must get a different Stripe key')
assert.ok(k1.length <= 255 && k1.startsWith('roofos:'), 'namespaced key must be bounded and tagged')

const route = readFileSync(new URL('../app/api/receptionist/stripe/payment-link/route.ts', import.meta.url), 'utf8')
assert.match(route, /paymentLinkReuse\(/, 'route must decide reuse via the shared helper')
assert.match(route, /'mismatch'/, 'a mismatched invoice must be rejected')
assert.match(route, /23505/, 'a unique-violation on insert must be handled as an idempotent replay')
assert.match(route, /invoice_id/, 'the reuse lookup must prove invoice binding')
assert.match(route, /stripeIdempotencyKey\(workspaceId,\s*invoice\.id,\s*body\.idempotencyKey\)/, 'the Stripe call must use the namespaced key')
assert.ok(!/\{\s*idempotencyKey:\s*body\.idempotencyKey\s*\}/.test(route), 'the raw client key must not be passed to Stripe')

console.log('payment-link-idempotency-test: PASS (reuse bound to invoice; expired/mismatch distinct; unique-violation replay)')
