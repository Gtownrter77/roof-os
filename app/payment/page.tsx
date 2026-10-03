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

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="mx-auto max-w-xl">
        <section className="bg-white rounded-lg shadow p-6 mb-4">
          <h1 className="text-2xl font-bold">ROOF/OS Billing</h1>
          <p className="text-gray-600 text-sm mt-2">
            Payment is handled by Stripe-hosted Checkout. ROOF/OS never collects or stores card numbers.
          </p>
        </section>

        {checkoutState === 'success' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg mb-4 text-sm" role="status">
            Checkout returned successfully. Subscription status is synchronized from Stripe webhooks; no local success is assumed.
          </div>
        )}
        {checkoutState === 'cancelled' && (
          <div className="bg-gray-100 border border-gray-200 text-gray-700 p-3 rounded-lg mb-4 text-sm" role="status">
            Checkout was cancelled. No local payment success was recorded.
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 text-sm" role="alert">{error}</div>}

        <div className="space-y-3 mb-4">
          {Object.entries(plans).map(([key, plan]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPlan(key as keyof typeof plans)}
              className={`w-full bg-white rounded-lg shadow p-4 flex justify-between items-center border-2 ${selectedPlan === key ? 'border-blue-500' : 'border-transparent'}`}
            >
              <div className="text-left">
                <p className="font-semibold">{plan.label}</p>
                <p className="text-sm text-gray-500">${plan.price}/month</p>
              </div>
              {selectedPlan === key && <span className="text-blue-600">✓</span>}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void startCheckout()}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? 'Opening Stripe Checkout…' : `Continue to Stripe — $${plans[selectedPlan].price}/mo`}
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">
          Billing changes are restricted to workspace administrators and are confirmed by Stripe webhook events.
        </p>
      </div>
    </main>
  )
}
