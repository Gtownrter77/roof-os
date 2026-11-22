import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import {
  resolvePaymentLinkIdentity,
  canAdvancePaymentLinkStatus,
  invoiceStatusForEvent,
  type StripeEventObjectLike,
} from '../../../../../lib/receptionist/stripe-webhook'

function statusForEvent(type: string): string | null {
  if (type === 'checkout.session.completed') return 'paid'
  if (type === 'checkout.session.expired') return 'expired'
  if (type === 'payment_intent.payment_failed') return 'failed'
  if (type === 'charge.refunded') return 'refunded'
  return null
}

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!stripeKey || !webhookSecret) return new Response('Stripe webhook is not configured', { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing Stripe signature', { status: 400 })
  const body = await request.text()
  let event: Stripe.Event
  try {
    const stripe = new Stripe(stripeKey)
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return new Response('Invalid Stripe signature', { status: 400 })
  }

  const admin = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode === 'subscription' && session.subscription && session.metadata?.workspace_id && session.metadata?.plan) {
      const stripe = new Stripe(stripeKey)
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      ) as unknown as Stripe.Subscription
      const { error } = await admin.from('workspace_subscriptions').upsert({
        workspace_id: session.metadata.workspace_id,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: subscription.id,
        plan: session.metadata.plan,
        status: subscription.status,
        current_period_end: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' })
      if (error) return new Response('Could not persist subscription', { status: 502 })
      return new Response('ok')
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const workspaceId = subscription.metadata?.workspace_id
    if (!workspaceId) return new Response('ok')
    const { error } = await admin.from('workspace_subscriptions').update({
      status: subscription.status,
      current_period_end: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('workspace_id', workspaceId).eq('stripe_subscription_id', subscription.id)
    if (error) return new Response('Could not update subscription', { status: 502 })
    return new Response('ok')
  }

  const status = statusForEvent(event.type)
  if (!status) return new Response('ok')

  const identity = resolvePaymentLinkIdentity(event.type, event.data.object as unknown as StripeEventObjectLike)

  // Session events carry the stored provider_link_id. Payment-intent and charge
  // events do not, so correlate through the invoice/workspace metadata that was
  // stamped on the checkout session when the link was created.
  let paymentLink: { id: string; workspace_id: string; status: string } | null = null
  if (identity.providerLinkId) {
    const { data } = await admin.from('receptionist_payment_links')
      .select('id,workspace_id,status')
      .eq('provider', 'stripe')
      .eq('provider_link_id', identity.providerLinkId)
      .maybeSingle()
    paymentLink = data
  }
  if (!paymentLink && identity.invoiceId) {
    let query = admin.from('receptionist_payment_links')
      .select('id,workspace_id,status')
      .eq('provider', 'stripe')
      .eq('invoice_id', identity.invoiceId)
    if (identity.workspaceId) query = query.eq('workspace_id', identity.workspaceId)
    const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
    paymentLink = data
  }
  if (!paymentLink) return new Response('ok')

  // Idempotency: a duplicate delivery must not replay a state move.
  const eventKey = `stripe:${event.id}`
  const { data: priorEvent } = await admin.from('receptionist_events')
    .select('id')
    .eq('workspace_id', paymentLink.workspace_id)
    .eq('event_key', eventKey)
    .maybeSingle()
  if (priorEvent) return new Response('ok')

  const { error: eventError } = await admin.from('receptionist_events').upsert({
    workspace_id: paymentLink.workspace_id,
    event_key: eventKey,
    event_type: event.type,
    provider: 'stripe',
    payload: event,
  }, { onConflict: 'workspace_id,event_key' })
  if (eventError) return new Response('Could not persist webhook event', { status: 502 })

  // Never let an out-of-order or replayed event move a link backwards.
  if (!canAdvancePaymentLinkStatus(paymentLink.status, status)) return new Response('ok')
  await admin.from('receptionist_payment_links')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', paymentLink.id)

  const invoiceStatus = invoiceStatusForEvent(status)
  if (invoiceStatus && identity.invoiceId) {
    await admin.from('invoices')
      .update({ status: invoiceStatus, updated_at: new Date().toISOString() })
      .eq('id', identity.invoiceId)
      .eq('workspace_id', paymentLink.workspace_id)
  }
  return new Response('ok')
}
