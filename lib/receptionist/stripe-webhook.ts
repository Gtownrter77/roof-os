/**
 * Pure helpers for the Stripe webhook. Kept separate from the route so the
 * correlation, replay and status-transition rules can be tested without a
 * Stripe account or database.
 */

export type StripeEventObjectLike = {
  id?: string
  metadata?: Record<string, string> | null
  payment_intent?: string | { id?: string } | null
}

export type PaymentLinkIdentity = {
  providerLinkId: string | null
  invoiceId: string | null
  workspaceId: string | null
}

/**
 * Only checkout.session events carry the checkout-session id that is stored in
 * receptionist_payment_links.provider_link_id. Payment-intent and charge events
 * must correlate through the invoice/workspace metadata stamped on the session
 * when the link was created (Stripe propagates session metadata downstream).
 */
export function resolvePaymentLinkIdentity(
  eventType: string,
  object: StripeEventObjectLike,
): PaymentLinkIdentity {
  const metadata = object.metadata ?? {}
  const invoiceId = typeof metadata.invoice_id === 'string' && metadata.invoice_id ? metadata.invoice_id : null
  const workspaceId = typeof metadata.workspace_id === 'string' && metadata.workspace_id ? metadata.workspace_id : null
  const isSessionEvent = eventType.startsWith('checkout.session.')
  const providerLinkId = isSessionEvent && typeof object.id === 'string' && object.id.startsWith('cs_')
    ? object.id
    : null
  return { providerLinkId, invoiceId, workspaceId }
}

/** Terminal states rank at least as high as transitional ones so replays cannot regress. */
export const PAYMENT_LINK_STATUS_RANK: Record<string, number> = {
  created: 0,
  sent: 1,
  paid: 2,
  failed: 2,
  expired: 2,
  disputed: 3,
  refunded: 3,
}

export function canAdvancePaymentLinkStatus(current: string | null | undefined, next: string): boolean {
  const currentRank = current ? (PAYMENT_LINK_STATUS_RANK[current] ?? -1) : -1
  const nextRank = PAYMENT_LINK_STATUS_RANK[next] ?? -1
  return nextRank > currentRank
}

/**
 * The invoice repair may repeat at the same rank: a Stripe retry must be able
 * to finish a write that failed after the link was already advanced. It must
 * still reject a stale lower-rank event, otherwise a redelivered
 * `checkout.session.completed` would un-void an already-refunded invoice.
 */
export function canRepairInvoiceStatus(currentLinkStatus: string | null | undefined, nextStatus: string): boolean {
  const currentRank = currentLinkStatus ? (PAYMENT_LINK_STATUS_RANK[currentLinkStatus] ?? -1) : -1
  const nextRank = PAYMENT_LINK_STATUS_RANK[nextStatus] ?? -1
  // Same status is a retry repairing a partial write. A different status must
  // strictly advance: `paid` and `expired` share rank 2, so `>=` would let a
  // stale completed event alter an expired link.
  return nextRank >= 0 && (nextStatus === currentLinkStatus || nextRank > currentRank)
}

/** The legacy invoices table permits draft/issued/paid/void, not refunded. */
export function invoiceStatusForEvent(status: string): 'paid' | 'void' | null {
  if (status === 'paid') return 'paid'
  if (status === 'refunded') return 'void'
  return null
}
