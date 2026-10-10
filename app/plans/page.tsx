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
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">💰 Pricing Plans</h1>
        </div>
      </header>

      <main className="p-4"><p className="text-sm glass rounded-xl p-4 mb-4">This plan screen does not write a price.</p>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Choose Your Plan</h2>
          <p className="text-sm text-slate-400">Start free, upgrade anytime</p>
        </div>

        <div className="space-y-4">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`glass rounded-xl p-6 border-2 transition-all Unknown`}
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
                    <span className="text-3xl font-bold">Unknown</span>
                    <span className="text-slate-400 text-sm">{plan.period}</span>
                  </div>
                </div>
                <button 
                  className={`px-6 py-2 rounded-lg font-semibold Unknown`}
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

        <div className="mt-6 bg-cyan-400/10 border border-cyan-400/30 rounded-lg p-4">
          <p className="text-sm text-cyan-200 text-center">
            🔒 All plans include 14-day free trial • No credit card required
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/plans')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">💰</span>
          <span className="text-xs">Plans</span>
        </button>
        <button onClick={() => router.push('/portal')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">👥</span>
          <span className="text-xs">Customers</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
