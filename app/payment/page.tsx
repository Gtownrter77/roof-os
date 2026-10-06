'use client'

import { useEffect, useState } from 'react'

const plans = {
  starter: { price: 29, label: 'Starter' },
  pro: { price: 79, label: 'Pro' },
  enterprise: { price: 199, label: 'Enterprise' },
} as const

export default function PaymentPage() {
  const [checkoutState, setCheckoutState] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof plans>('pro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCheckoutState(new URLSearchParams(window.location.search).get('checkout'))
  }, [])

  async function startCheckout() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      })
      const payload = await response.json()
      if (!response.ok || typeof payload.url !== 'string') throw new Error(payload.error || 'Checkout could not be started.')
      window.location.assign(payload.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout could not be started.')
      setLoading(false)
    }
  }

  return <main className="ops-bg min-h-screen lg:pl-[232px] p-4 pb-16"><div className="mx-auto max-w-xl"><header className="mb-5"><p className="ops-label">Workspace billing</p><h1 className="text-3xl font-black">ROOF/OS Billing</h1><p className="mt-2 text-sm text-slate-400">Payment is handled by Stripe-hosted Checkout. ROOF/OS never collects or stores card numbers.</p></header>{checkoutState === 'success' && <div className="mb-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm text-cyan-200" role="status">Checkout returned successfully. Subscription status is synchronized from Stripe webhooks; no local success is assumed.</div>}{checkoutState === 'cancelled' && <div className="mb-4 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-slate-300" role="status">Checkout was cancelled. No local payment success was recorded.</div>}{error && <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</div>}<div className="mb-4 space-y-3">{Object.entries(plans).map(([key, plan]) => <button key={key} type="button" onClick={() => setSelectedPlan(key as keyof typeof plans)} className={`glass flex w-full items-center justify-between rounded-xl p-4 text-left ${selectedPlan === key ? 'border-cyan-400/70 shadow-[0_0_24px_rgba(22,201,255,.18)]' : ''}`}><div><p className="font-semibold text-white">{plan.label}</p><p className="text-sm text-slate-400">${plan.price}/month</p></div>{selectedPlan === key && <span className="text-cyan-300">✓</span>}</button>)}</div><button type="button" onClick={() => void startCheckout()} disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-red-600 to-rose-500 py-3 font-semibold text-white disabled:opacity-50">{loading ? 'Opening Stripe Checkout…' : `Continue to Stripe — $${plans[selectedPlan].price}/mo`}</button><p className="mt-3 text-center text-xs text-slate-500">Billing changes are restricted to workspace administrators and are confirmed by Stripe webhook events.</p></div></main>
}
