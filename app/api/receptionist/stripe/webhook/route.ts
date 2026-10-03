import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '../../../../../lib/supabase/admin'

function statusForEvent(type: string): string | null {
  if (type === 'checkout.session.completed') return 'paid'
  if (type === 'checkout.session.expired') return 'expired'
  if (type === 'payment_intent.payment_failed') return 'failed'
  if (type === 'charge.refunded') return 'refunded'
  return null
}

async function resolveCheckoutSession(stripe: Stripe, event: Stripe.Event) {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
    return event.data.object as Stripe.Checkout.Session
  }

  const object = event.data.object as Stripe.PaymentIntent | Stripe.Charge
  const paymentIntentId =
    event.type === 'payment_intent.payment_failed'
      ? object.id
      : typeof (object as Stripe.Charge).payment_intent === 'string'
        ? (object as Stripe.Charge).payment_intent
        : null

  if (!paymentIntentId) return null

  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  })
  return sessions.data[0] ?? null
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

  const status = statusForEvent(event.type)
  if (!status) return new Response('ok')

  const stripe = new Stripe(stripeKey)
  let session: Stripe.Checkout.Session | null
  try {
    session = await resolveCheckoutSession(stripe, event)
  } catch {
    return new Response('Could not resolve the Stripe Checkout session', { status: 502 })
  }

  if (!session?.id) return new Response('ok')

  const admin = createAdminClient()
  const { data: paymentLink, error: paymentLinkError } = await admin
    .from('receptionist_payment_links')
    .select('id,workspace_id,invoice_id')
    .eq('provider', 'stripe')
    .eq('provider_link_id', session.id)
    .maybeSingle()

  if (paymentLinkError) return new Response('Could not read the payment-link ledger', { status: 502 })
  if (!paymentLink) return new Response('ok')

  const { error: eventError } = await admin
    .from('receptionist_events')
    .upsert({
      workspace_id: paymentLink.workspace_id,
      event_key: `stripe:${event.id}`,
      event_type: event.type,
      provider: 'stripe',
      payload: event,
    }, { onConflict: 'workspace_id,event_key' })

  if (eventError) return new Response('Could not persist webhook event', { status: 502 })

  const { error: paymentUpdateError } = await admin
    .from('receptionist_payment_links')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', paymentLink.id)

  if (paymentUpdateError) return new Response('Could not update payment status', { status: 502 })

  if (status === 'paid' && paymentLink.invoice_id) {
    const { error: invoiceUpdateError } = await admin
      .from('invoices')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', paymentLink.invoice_id)
      .eq('workspace_id', paymentLink.workspace_id)

    if (invoiceUpdateError) return new Response('Could not update invoice status', { status: 502 })
  }

  return new Response('ok')
}
