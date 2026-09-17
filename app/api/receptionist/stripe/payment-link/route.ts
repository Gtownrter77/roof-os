import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../../../lib/supabase/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  const appUrl = process.env.RECEPTIONIST_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!stripeKey || !appUrl) return NextResponse.json({ error: 'Stripe and public application URL are not configured.' }, { status: 503 })
  let body: { invoiceId?: string; idempotencyKey?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  if (!body.invoiceId || !body.idempotencyKey) return NextResponse.json({ error: 'invoiceId and idempotencyKey are required.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: existing } = await admin.from('receptionist_payment_links').select('id,url,status,provider_link_id,amount_cents,currency').eq('workspace_id', workspaceId).eq('idempotency_key', body.idempotencyKey).maybeSingle()
  if (existing) return NextResponse.json({ paymentLink: existing, reused: true })
  const { data: invoice, error: invoiceError } = await admin.from('invoices').select('id,workspace_id,lead_id,invoice_number,amount_cents,currency,status').eq('id', body.invoiceId).eq('workspace_id', workspaceId).eq('status', 'issued').single()
  if (invoiceError || !invoice) return NextResponse.json({ error: 'Only an issued invoice in the active workspace can receive a payment link.' }, { status: 409 })
  const stripe = new Stripe(stripeKey)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: invoice.currency, product_data: { name: `ROOF/OS invoice ${invoice.invoice_number}` }, unit_amount: invoice.amount_cents }, quantity: 1 }],
    success_url: `${appUrl}/payment?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment?status=cancelled`,
    customer_creation: 'always',
    metadata: { workspace_id: workspaceId, invoice_id: invoice.id, lead_id: invoice.lead_id || '' },
  }, { idempotencyKey: body.idempotencyKey })
  if (!session.url) return NextResponse.json({ error: 'Stripe did not return a hosted payment URL.' }, { status: 502 })
  const { data: paymentLink, error: saveError } = await admin.from('receptionist_payment_links').insert({ workspace_id: workspaceId, lead_id: invoice.lead_id, invoice_id: invoice.id, provider: 'stripe', provider_link_id: session.id, amount_cents: invoice.amount_cents, currency: invoice.currency, status: 'created', url: session.url, idempotency_key: body.idempotencyKey, created_by: user.id }).select('id,url,status,provider_link_id,amount_cents,currency').single()
  if (saveError) return NextResponse.json({ error: 'Could not persist the Stripe payment link.', detail: saveError.message }, { status: 502 })
  return NextResponse.json({ paymentLink })
}
