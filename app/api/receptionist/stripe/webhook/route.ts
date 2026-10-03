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

  const object = event.data.object as Stripe.Checkout.Session & { payment_intent?: string | Stripe.PaymentIntent }
  const providerLinkId = typeof object.id === 'string' ? object.id : typeof object.payment_intent === 'string' ? object.payment_intent : null
  if (!providerLinkId) return new Response('ok')
  const { data: paymentLink } = await admin.from('receptionist_payment_links').select('id,workspace_id').eq('provider', 'stripe').eq('provider_link_id', providerLinkId).maybeSingle()
  if (!paymentLink) return new Response('ok')
  const { error: eventError } = await admin.from('receptionist_events').upsert({
    workspace_id: paymentLink.workspace_id,
    event_key: `stripe:${event.id}`,
    event_type: event.type,
    provider: 'stripe',
    payload: event,
  }, { onConflict: 'workspace_id,event_key' })
  if (eventError) return new Response('Could not persist webhook event', { status: 502 })
  await admin.from('receptionist_payment_links').update({ status, updated_at: new Date().toISOString() }).eq('id', paymentLink.id)
  if (status === 'paid' && object.metadata?.invoice_id) {
    await admin.from('invoices').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', object.metadata.invoice_id).eq('workspace_id', paymentLink.workspace_id)
  }
  return new Response('ok')
}
