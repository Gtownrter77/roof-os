import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  resolvePaymentLinkIdentity,
  canAdvancePaymentLinkStatus,
  invoiceStatusForEvent,
} from '../lib/receptionist/stripe-webhook.ts'

// A checkout-session event carries the link id; payment-intent/charge events do
// not, so they must fall back to the invoice/workspace metadata stamped on the
// session at creation time. The old code read object.id for every event and
// silently dropped failed payments and refunds.
assert.deepEqual(
  resolvePaymentLinkIdentity('checkout.session.completed', { id: 'cs_123', metadata: { invoice_id: 'inv_1', workspace_id: 'ws_1' } }),
  { providerLinkId: 'cs_123', invoiceId: 'inv_1', workspaceId: 'ws_1' },
)
assert.deepEqual(
  resolvePaymentLinkIdentity('payment_intent.payment_failed', { id: 'pi_123', metadata: { invoice_id: 'inv_1', workspace_id: 'ws_1' } }),
  { providerLinkId: null, invoiceId: 'inv_1', workspaceId: 'ws_1' },
)
assert.deepEqual(
  resolvePaymentLinkIdentity('charge.refunded', { id: 'ch_123', payment_intent: 'pi_123', metadata: { invoice_id: 'inv_1', workspace_id: 'ws_1' } }),
  { providerLinkId: null, invoiceId: 'inv_1', workspaceId: 'ws_1' },
)
assert.deepEqual(
  resolvePaymentLinkIdentity('checkout.session.expired', { id: 'cs_123', metadata: {} }),
  { providerLinkId: 'cs_123', invoiceId: null, workspaceId: null },
)

// A replayed completed event must not regress a terminal state.
assert.equal(canAdvancePaymentLinkStatus('created', 'paid'), true)
assert.equal(canAdvancePaymentLinkStatus('paid', 'refunded'), true)
assert.equal(canAdvancePaymentLinkStatus('refunded', 'paid'), false)
assert.equal(canAdvancePaymentLinkStatus('paid', 'paid'), false)
assert.equal(canAdvancePaymentLinkStatus('expired', 'paid'), false)

// The legacy invoices table allows draft/issued/paid/void, not refunded.
assert.equal(invoiceStatusForEvent('paid'), 'paid')
assert.equal(invoiceStatusForEvent('refunded'), 'void')
assert.equal(invoiceStatusForEvent('failed'), null)
assert.equal(invoiceStatusForEvent('expired'), null)

const route = readFileSync('app/api/receptionist/stripe/webhook/route.ts', 'utf8')
assert.match(route, /resolvePaymentLinkIdentity/, 'route must resolve link identity per event type')
assert.match(route, /canAdvancePaymentLinkStatus/, 'route must guard against status regression')
assert.match(route, /invoiceStatusForEvent/, 'route must map refunds to an invoice state')
assert.match(route, /priorEvent/, 'route must short-circuit replayed events')
console.log('stripe-webhook-contract-test: PASS (event correlation, replay guard, monotonic status, refund invoice state)')
