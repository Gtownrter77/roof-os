'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const router = useRouter()
  const [pricing, setPricing] = useState({
    materials: {
      shingles: { price: 95, unit: 'sq', quantity: 0, surge: false },
      underlayment: { price: 45, unit: 'roll', quantity: 0, surge: false },
      flashing: { price: 8, unit: 'ft', quantity: 0, surge: false },
      gutters: { price: 12, unit: 'ft', quantity: 0, surge: false },
      dripEdge: { price: 3, unit: 'ft', quantity: 0, surge: false },
      iceWaterShield: { price: 65, unit: 'roll', quantity: 0, surge: true }, // Surge alert example
      ridgeVent: { price: 4, unit: 'ft', quantity: 0, surge: false },
      starterShingles: { price: 2.5, unit: 'ft', quantity: 0, surge: false },
    },
    labor: {
      tearOff: { rate: 55, unit: 'sq', quantity: 0 },
      installation: { rate: 65, unit: 'sq', quantity: 0 },
      flashingWork: { rate: 85, unit: 'hr', quantity: 0 },
      gutterWork: { rate: 75, unit: 'hr', quantity: 0 },
      cleanup: { rate: 50, unit: 'hr', quantity: 0 },
    },
    overhead: 0.15,
    profit: 0.20, // 20% default profit target
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
    grossMarginPercent: 35,
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

    const directCost = materialTotal + laborTotal
    const overhead = directCost * pricing.overhead
    const profit = (directCost + overhead) * pricing.profit
    const taxes = (materialTotal + laborTotal) * pricing.salesTax
    const subtotal = directCost + overhead + profit + pricing.permits + pricing.dumpFees
    const total = subtotal + taxes

    const grossProfitDollar = total - directCost - taxes
    const grossMarginPercent = total > 0 ? (grossProfitDollar / total) * 100 : 35

    setTotals({
      materials: materialTotal,
      labor: laborTotal,
      overhead: overhead,
      profit: profit,
      taxes: taxes,
      total: total,
      perSquare: total / (pricing.materials.shingles.quantity || 1),
      grossMarginPercent,
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

  const isLowMargin = totals.grossMarginPercent < 35

  return (
    <div className="ops-bg min-h-screen lg:pl-[232px] pb-16">
      <header className="glass sticky top-0 z-10 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button>
            <h1 className="text-xl font-black text-white">💰 Price Book & Margin Guard</h1>
          </div>
          <span className="rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-black">35% MARGIN FLOOR</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] p-4 space-y-4">
        {isLowMargin && (
          <div className="bg-red-500/20 border-2 border-red-500 p-3 rounded-xl text-red-200 text-xs flex justify-between items-center">
            <div>
              <p className="font-bold text-sm text-red-100">🚨 OWNER MARGIN GUARD ALERT: Below 35% Floor</p>
              <p>Current Gross Margin: <strong>{totals.grossMarginPercent.toFixed(1)}%</strong>. Unprofitable bids are blocked.</p>
            </div>
            <span className="bg-red-600 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase">MARGIN BLOCKED</span>
          </div>
        )}

        {/* Quick Input */}
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 text-white">📐 Quick Area Estimate</h3>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Roof Area (sq ft)"
              className="flex-1 p-2 border border-white/20 rounded-lg bg-black/30 text-white text-sm"
              onChange={(e) => updateQuantities(Number(e.target.value))}
            />
            <button className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-white font-semibold text-sm">
              Calculate
            </button>
          </div>
        </div>

        {/* Materials */}
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex justify-between text-white">
            <span>🧱 Materials (Retail Watchlist)</span>
            <span className="text-emerald-300">${totals.materials.toFixed(2)}</span>
          </h3>
          <div className="space-y-2">
            {Object.entries(pricing.materials).map(([key, item]) => (
              <div key={key} className="grid grid-cols-4 gap-2 items-center text-white">
                <div className="flex items-center space-x-1">
                  <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  {item.surge && <span className="text-[9px] bg-red-500 text-white font-bold px-1 rounded">SURGE</span>}
                </div>
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
                <span className="text-xs font-medium text-right text-cyan-200">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className={`rounded-xl border-2 p-4 ${isLowMargin ? 'border-red-500/80 bg-red-950/20' : 'border-cyan-400/50 bg-cyan-400/10'}`}>
          <div className="space-y-2 text-white">
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
            <div className="border-t pt-2 border-blue-300">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Estimate</span>
                <span className="text-cyan-300">${totals.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Gross Margin %</span>
                <span className={`font-bold ${isLowMargin ? 'text-red-400' : 'text-emerald-400'}`}>{totals.grossMarginPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
