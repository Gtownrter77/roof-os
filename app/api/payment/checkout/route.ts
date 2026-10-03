import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

const PLANS = {
  starter: { label: 'Starter', price: 29 },
  pro: { label: 'Pro', price: 79 },
  enterprise: { label: 'Enterprise', price: 199 },
} as const

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey) return NextResponse.json({ error: 'Stripe checkout is not configured on this server.' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !isUuid(workspaceId)) return NextResponse.json({ error: 'An active workspace is required.' }, { status: 403 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (adminError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  if (!isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required to manage billing.' }, { status: 403 })

  const parsed = await readJson(request, 4096)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as { plan?: unknown }
  if (typeof body.plan !== 'string' || !(body.plan in PLANS)) return NextResponse.json({ error: 'A valid billing plan is required.' }, { status: 400 })

  const plan = PLANS[body.plan as keyof typeof PLANS]
  const stripe = new Stripe(stripeKey)
  const origin = new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `ROOF/OS ${plan.label}` },
        unit_amount: plan.price * 100,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    customer_email: user.email ?? undefined,
    success_url: `${origin}/payment?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/payment?checkout=cancelled`,
    metadata: { workspace_id: workspaceId, user_id: user.id, plan: body.plan },
    subscription_data: {
      metadata: { workspace_id: workspaceId, user_id: user.id, plan: body.plan },
    },
  })

  if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 })
  return NextResponse.json({ url: session.url })
}
