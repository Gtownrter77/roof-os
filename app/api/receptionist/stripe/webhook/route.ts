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
  const status = statusForEvent(event.type)
  if (!status) return new Response('ok')
  const object = event.data.object as Stripe.Checkout.Session & { payment_intent?: string | Stripe.PaymentIntent }
  const providerLinkId = typeof object.id === 'string' ? object.id : typeof object.payment_intent === 'string' ? object.payment_intent : null
  if (!providerLinkId) return new Response('ok')
  const admin = createAdminClient()
  const { data: paymentLink } = await admin.from('receptionist_payment_links').select('id,workspace_id').eq('provider', 'stripe').eq('provider_link_id', providerLinkId).maybeSingle()
  if (!paymentLink) return new Response('ok')
  const { error: eventError } = await admin.from('receptionist_events').upsert({ workspace_id: paymentLink.workspace_id, event_key: `stripe:${event.id}`, event_type: event.type, provider: 'stripe', payload: event }, { onConflict: 'workspace_id,event_key' })
  if (eventError) return new Response('Could not persist webhook event', { status: 502 })
  await admin.from('receptionist_payment_links').update({ status, updated_at: new Date().toISOString() }).eq('id', paymentLink.id)
  if (status === 'paid' && object.metadata?.invoice_id) {
    await admin.from('invoices').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', object.metadata.invoice_id).eq('workspace_id', paymentLink.workspace_id)
  }
  return new Response('ok')
}
