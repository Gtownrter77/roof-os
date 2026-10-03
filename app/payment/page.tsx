'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const plans = {
  starter: { price: 29, label: 'Starter' },
  pro: { price: 79, label: 'Pro' },
  enterprise: { price: 199, label: 'Enterprise' },
} as const

type PlanKey = keyof typeof plans

export default function PaymentPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('pro')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💳 Billing</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-4 mb-4 text-sm">
          <p className="font-semibold">Subscription checkout is not configured.</p>
          <p className="mt-1">
            No card data is collected and no payment is reported as successful from this screen.
            A real subscription requires a server-side Stripe checkout flow and verified webhook state.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-bold mb-2">ROOF/OS plans</h2>
          <p className="text-gray-500 text-sm">Select a plan to prepare the intended subscription tier.</p>
        </div>

        <div className="space-y-3 mb-4">
          {(Object.entries(plans) as Array<[PlanKey, typeof plans[PlanKey]]>).map(([key, plan]) => (
            <button
              key={key}
              onClick={() => setSelectedPlan(key)}
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

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-medium">Selected plan</p>
          <p className="text-lg font-bold mt-1">{plans[selectedPlan].label}</p>
          <p className="text-sm text-gray-500">${plans[selectedPlan].price}/month</p>
          <button
            type="button"
            disabled
            className="w-full mt-4 bg-gray-300 text-gray-600 py-3 rounded-lg font-semibold cursor-not-allowed"
          >
            Checkout unavailable until billing is configured
          </button>
        </div>
      </main>
    </div>
  )
}
