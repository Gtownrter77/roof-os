import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  resolvePaymentLinkIdentity,
  canAdvancePaymentLinkStatus,
  canRepairInvoiceStatus,
  invoiceStatusForEvent,
} from '../lib/receptionist/stripe-webhook.ts'

// Confirmation-review regression: moving the invoice write outside the link
// monotonic guard lets a stale `checkout.session.completed` redelivery revert
// an already-refunded invoice to paid. Equal rank must be allowed (so a retry
// repairs a failed partial write), but a lower-rank replay must be rejected.
assert.equal(canRepairInvoiceStatus('paid', 'paid'), true, 'retry of a partial write must repair the invoice')
assert.equal(canRepairInvoiceStatus('created', 'paid'), true, 'a fresh payment must set the invoice')
assert.equal(canRepairInvoiceStatus('paid', 'refunded'), true, 'a refund must void the invoice')
assert.equal(canRepairInvoiceStatus('refunded', 'refunded'), true, 'a replayed refund must be idempotent')
assert.equal(canRepairInvoiceStatus('refunded', 'paid'), false, 'a stale completed event must not un-void a refunded invoice')
assert.equal(canRepairInvoiceStatus('expired', 'paid'), false, 'a stale completed event must not overwrite an expired link')

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

// Batch 10 / 91: a failed status write returned as 200 tells Stripe delivery
// succeeded, so the event is never retried and the payment ledger diverges.
assert.match(route, /const \{ error: linkUpdateError \} = await admin\.from\('receptionist_payment_links'\)/, 'payment-link status update must capture its write error')
assert.match(route, /if \(linkUpdateError\) return new Response\([^\n]*status: 502/, 'payment-link write failure must be retryable by Stripe')
assert.match(route, /const \{ error: invoiceUpdateError \} = await admin\.from\('invoices'\)/, 'invoice status update must capture its write error')
assert.match(route, /if \(invoiceUpdateError\) return new Response\([^\n]*status: 502/, 'invoice write failure must be retryable by Stripe')

// A 502 is only useful if Stripe's retry can actually repair the failed write.
assert.ok(!route.includes("if (!canAdvancePaymentLinkStatus(paymentLink.status, status)) return new Response('ok')"), 'the monotonic guard must not short-circuit invoice repair on a retry')
const linkGuardBlock = route.match(/if \(canAdvancePaymentLinkStatus\(paymentLink\.status, status\)\) \{([\s\S]*?)\n  \}/)
assert.ok(linkGuardBlock && linkGuardBlock[1].includes('linkUpdateError') && !linkGuardBlock[1].includes('invoiceStatusForEvent'), 'invoice repair must run outside the link-status guard')
assert.ok(route.indexOf("eq('event_key', eventKey)") > route.indexOf('invoiceUpdateError'), 'the dedupe marker must be written only after all state writes succeed')
assert.match(route, /invoiceStatus && identity\.invoiceId && canRepairInvoiceStatus\(/, 'the invoice write must be rank-guarded so stale events cannot regress it')
console.log('stripe-webhook-contract-test: PASS (event correlation, replay guard, monotonic status, refund invoice state, checked status writes, rank-guarded retry repair)')
