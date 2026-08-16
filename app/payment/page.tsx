'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PaymentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('pro')

  const plans = {
    starter: { price: 29, label: 'Starter' },
    pro: { price: 79, label: 'Pro' },
    enterprise: { price: 199, label: 'Enterprise' }
  }

  const handlePayment = () => {
    setLoading(true)
    setTimeout(() => {
      alert(`✅ Payment successful! You're now on the ${plans[selectedPlan as keyof typeof plans].label} plan.`)
      setLoading(false)
      router.push('/')
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💳 Payment</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-bold mb-2">Subscribe to ROOF/OS</h2>
          <p className="text-gray-500 text-sm">Choose your plan and start building</p>
        </div>

        <div className="space-y-3 mb-4">
          {Object.entries(plans).map(([key, plan]) => (
            <button
              key={key}
              onClick={() => setSelectedPlan(key)}
              className={`w-full bg-white rounded-lg shadow p-4 flex justify-between items-center border-2 ${
                selectedPlan === key ? 'border-blue-500' : 'border-transparent'
              }`}
            >
              <div>
                <p className="font-semibold">{plan.label}</p>
                <p className="text-sm text-gray-500">${plan.price}/month</p>
              </div>
              {selectedPlan === key && <span className="text-blue-600">✓</span>}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">Payment Method</h3>
          <div className="space-y-3">
            <input
              type="text"
              className="w-full p-3 border rounded-lg"
              placeholder="Card Number"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                className="w-full p-3 border rounded-lg"
                placeholder="MM/YY"
              />
              <input
                type="text"
                className="w-full p-3 border rounded-lg"
                placeholder="CVC"
              />
            </div>
            <input
              type="text"
              className="w-full p-3 border rounded-lg"
              placeholder="Name on Card"
            />
          </div>
        </div>

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Processing...' : `💳 Subscribe $${plans[selectedPlan as keyof typeof plans].price}/mo`}
        </button>

        <p className="text-xs text-gray-400 text-center mt-2">
          🔒 Secure payment processing • Cancel anytime
        </p>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/plans')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Plans</span>
        </button>
        <button onClick={() => router.push('/payment')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">💳</span>
          <span className="text-xs">Pay</span>
        </button>
        <button onClick={() => router.push('/status')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Status</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
