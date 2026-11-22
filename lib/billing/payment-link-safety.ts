/** Pure idempotency decision for Stripe payment links. An idempotency key is
 * only reusable for the invoice it was originally created for. */

export type PaymentLinkRow = {
  id: string
  invoice_id: string | null
  expires_at?: string | null
  [key: string]: unknown
}

export type ReuseDecision = 'none' | 'mismatch' | 'expired' | 'reuse'

export function paymentLinkReuse(
  existing: PaymentLinkRow | null | undefined,
  requestedInvoiceId: string,
  nowIso: string
): ReuseDecision {
  if (!existing) return 'none'
  if (existing.invoice_id !== requestedInvoiceId) return 'mismatch'
  if (existing.expires_at && Date.parse(existing.expires_at) <= Date.parse(nowIso)) return 'expired'
  return 'reuse'
}

/** Stripe-side idempotency key bound to workspace, invoice and caller key.
 *
 * Stripe caches a session by the key we send. If the ledger insert fails after
 * Stripe creates the session, a later request with the same client key but a
 * DIFFERENT invoice must not consume that cached session. Namespacing by
 * workspace + invoice makes the Stripe cache agrees with our ledger binding.
 * Output is bounded (<255 chars) and tagged for operator traceability. */
export async function stripeIdempotencyKey(
  workspaceId: string,
  invoiceId: string,
  clientKey: string
): Promise<string> {
  const raw = `${workspaceId}:${invoiceId}:${clientKey}`
  // A cryptographic digest so a collision cannot bind a different client key
  // to a cached Stripe session. Stripe caps idempotency keys at 255 chars; the
  // bounded ids plus a 64-hex SHA-256 suffix stay well inside that limit.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const suffix = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `roofos:${workspaceId}:${invoiceId}:${suffix}`
}
