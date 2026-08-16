'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PlansPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState('pro')

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '29',
      period: '/month',
      features: [
        'Up to 50 leads',
        'Basic inspections',
        'Weather alerts',
        'Email support'
      ],
      button: 'Start Free Trial',
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '79',
      period: '/month',
      features: [
        'Unlimited leads',
        'AI report generation',
        'Advanced analytics',
        'Priority support',
        'Camera integration',
        'Voice assistant'
      ],
      button: 'Start Free Trial',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '199',
      period: '/month',
      features: [
        'Everything in Pro',
        'Multi-location support',
        'Custom integrations',
        'Dedicated support',
        'White-label option',
        'API access'
      ],
      button: 'Contact Sales',
      popular: false
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💰 Pricing Plans</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Choose Your Plan</h2>
          <p className="text-sm text-gray-500">Start free, upgrade anytime</p>
        </div>

        <div className="space-y-4">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`bg-white rounded-lg shadow p-6 border-2 transition-all ${
                plan.popular ? 'border-blue-500' : 'border-transparent'
              }`}
            >
              {plan.popular && (
                <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full inline-block mb-2">
                  ⭐ Most Popular
                </span>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>
                </div>
                <button 
                  className={`px-6 py-2 rounded-lg font-semibold ${
                    plan.popular 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {plan.button}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 text-center">
            🔒 All plans include 14-day free trial • No credit card required
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/plans')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">💰</span>
          <span className="text-xs">Plans</span>
        </button>
        <button onClick={() => router.push('/portal')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👥</span>
          <span className="text-xs">Customers</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
