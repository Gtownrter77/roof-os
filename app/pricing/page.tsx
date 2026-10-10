'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pricing, setPricing] = useState({
    materials: {
      shingles: { price: 95, unit: 'sq', quantity: 0 },
      underlayment: { price: 45, unit: 'roll', quantity: 0 },
      flashing: { price: 8, unit: 'ft', quantity: 0 },
      gutters: { price: 12, unit: 'ft', quantity: 0 },
      dripEdge: { price: 3, unit: 'ft', quantity: 0 },
      iceWaterShield: { price: 65, unit: 'roll', quantity: 0 },
      ridgeVent: { price: 4, unit: 'ft', quantity: 0 },
      starterShingles: { price: 2.5, unit: 'ft', quantity: 0 },
    },
    labor: {
      tearOff: { rate: 55, unit: 'sq', quantity: 0 },
      installation: { rate: 65, unit: 'sq', quantity: 0 },
      flashingWork: { rate: 85, unit: 'hr', quantity: 0 },
      gutterWork: { rate: 75, unit: 'hr', quantity: 0 },
      cleanup: { rate: 50, unit: 'hr', quantity: 0 },
    },
    overhead: 0.15,
    profit: 0.10,
    salesTax: 0.07,
    permits: 250,
    dumpFees: 150,
  })

  const [totals, setTotals] = useState({
    materials: 0,
    labor: 0,
    overhead: 0,
    profit: 0,
    taxes: 0,
    total: 0,
    perSquare: 0,
  })

  // Update quantities based on roof area
  const updateQuantities = (roofArea: number) => {
    const sq = roofArea / 100 // Convert to squares
    setPricing(prev => ({
      ...prev,
      materials: {
        ...prev.materials,
        shingles: { ...prev.materials.shingles, quantity: sq },
        underlayment: { ...prev.materials.underlayment, quantity: Math.ceil(sq / 2) },
        flashing: { ...prev.materials.flashing, quantity: roofArea * 0.1 },
        gutters: { ...prev.materials.gutters, quantity: roofArea * 0.15 },
        dripEdge: { ...prev.materials.dripEdge, quantity: roofArea * 0.2 },
        iceWaterShield: { ...prev.materials.iceWaterShield, quantity: Math.ceil(sq / 3) },
        ridgeVent: { ...prev.materials.ridgeVent, quantity: roofArea * 0.05 },
        starterShingles: { ...prev.materials.starterShingles, quantity: roofArea * 0.1 },
      },
      labor: {
        ...prev.labor,
        tearOff: { ...prev.labor.tearOff, quantity: sq },
        installation: { ...prev.labor.installation, quantity: sq },
        flashingWork: { ...prev.labor.flashingWork, quantity: roofArea * 0.02 },
        gutterWork: { ...prev.labor.gutterWork, quantity: roofArea * 0.015 },
        cleanup: { ...prev.labor.cleanup, quantity: roofArea * 0.01 },
      }
    }))
  }

  const calculateTotals = () => {
    const materialTotal = Object.values(pricing.materials).reduce((sum, item) => {
      return sum + (item.price * item.quantity)
    }, 0)

    const laborTotal = Object.values(pricing.labor).reduce((sum, item) => {
      return sum + (item.rate * item.quantity)
    }, 0)

    const overhead = materialTotal * pricing.overhead
    const profit = (materialTotal + laborTotal + overhead) * pricing.profit
    const taxes = (materialTotal + laborTotal) * pricing.salesTax
    const subtotal = materialTotal + laborTotal + overhead + profit + pricing.permits + pricing.dumpFees
    const total = subtotal + taxes

    setTotals({
      materials: materialTotal,
      labor: laborTotal,
      overhead: overhead,
      profit: profit,
      taxes: taxes,
      total: total,
      perSquare: total / (pricing.materials.shingles.quantity || 1),
    })
  }

  useEffect(() => {
    calculateTotals()
  }, [pricing])

  const updatePrice = (category: 'materials' | 'labor', item: string, field: 'price' | 'rate' | 'quantity', value: number) => {
    setPricing(prev => ({
      ...prev,
      [category]: {
        // @ts-ignore
        ...prev[category],
        [item]: {
          // @ts-ignore
          ...prev[category][item],
          [field]: value
        }
      }
    }))
  }

  const updateQuantity = (category: 'materials' | 'labor', item: string, value: number) => {
    updatePrice(category, item, 'quantity', value)
  }

  const updateRate = (category: 'materials' | 'labor', item: string, value: number) => {
    updatePrice(category, item, category === 'materials' ? 'price' : 'rate', value)
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1240px] items-center px-4 py-3">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-black">💰 Live Retailer Pricing</h1>
          <span className="ml-2 rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-black">LIVE REFERENCE</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] p-4">
        {/* Quick Input */}
        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">📐 Quick Estimate</h3>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Roof Area (sq ft)"
              className="ops-input flex-1"
              onChange={(e) => updateQuantities(Number(e.target.value))}
            />
            <button className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-white">
              Calculate
            </button>
          </div>
        </div>

        {/* Materials */}
        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex justify-between">
            <span>🧱 Materials</span>
            <span className="text-emerald-300">${totals.materials.toFixed(2)}</span>
          </h3>
          <div className="space-y-2">
            {Object.entries(pricing.materials).map(([key, item]) => (
              <div key={key} className="grid grid-cols-4 gap-2 items-center">
                <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateRate('materials', key, Number(e.target.value))}
                  className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity('materials', key, Number(e.target.value))}
                  className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white"
                />
                <span className="text-xs font-medium text-right">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Labor */}
        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex justify-between">
            <span>👷 Labor</span>
            <span className="text-emerald-300">${totals.labor.toFixed(2)}</span>
          </h3>
          <div className="space-y-2">
            {Object.entries(pricing.labor).map(([key, item]) => (
              <div key={key} className="grid grid-cols-4 gap-2 items-center">
                <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => updateRate('labor', key, Number(e.target.value))}
                  className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity('labor', key, Number(e.target.value))}
                  className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white"
                />
                <span className="text-xs font-medium text-right">
                  ${(item.rate * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Overhead & Profit */}
        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">📊 Overhead & Profit</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Overhead %</label>
              <input
                type="number"
                value={Math.round(pricing.overhead * 100)}
                onChange={(e) => setPricing({...pricing, overhead: Number(e.target.value) / 100})}
                className="w-full rounded border border-white/15 bg-black/25 p-2 text-sm text-white"
              />
              <span className="text-xs text-emerald-300">${totals.overhead.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-xs text-slate-400">Profit %</label>
              <input
                type="number"
                value={Math.round(pricing.profit * 100)}
                onChange={(e) => setPricing({...pricing, profit: Number(e.target.value) / 100})}
                className="w-full rounded border border-white/15 bg-black/25 p-2 text-sm text-white"
              />
              <span className="text-xs text-emerald-300">${totals.profit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="rounded-xl border-2 border-cyan-400/50 bg-cyan-400/10 p-4 mb-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Materials</span>
              <span className="font-medium">${totals.materials.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Labor</span>
              <span className="font-medium">${totals.labor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Overhead</span>
              <span className="font-medium">${totals.overhead.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Profit</span>
              <span className="font-medium">${totals.profit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Taxes</span>
              <span className="font-medium">${totals.taxes.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 border-blue-300">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Estimate</span>
                <span className="text-cyan-300">${totals.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Per Square</span>
                <span>${totals.perSquare.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 py-2 text-sm text-white">
              📄 Generate Report
            </button>
            <button className="rounded-lg bg-emerald-600 py-2 text-sm text-white">
              📧 Send Quote
            </button>
          </div>
        </div>

        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-slate-300">
            Live Home Depot and Lowe&apos;s retailer reference pricing • Updated weekly by default • Refresh on demand • Xactimate-friendly workflow formatting
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Prices retain retailer, market/ZIP, retrieval time, effective date, and owner-review status. They are not licensed Xactimate or carrier rates.
          </p>
        </div>
      </main>

      <nav className="hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/invoices')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Invoices</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
