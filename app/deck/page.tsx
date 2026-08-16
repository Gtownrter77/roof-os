'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeckPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)

  const [form, setForm] = useState({
    deckSize: 0,
    height: 0,
    material: 'Pressure Treated',
    deckingType: 'Composite',
    includesRails: true,
    includesStairs: false,
    includesLighting: false,
    includesBuiltInSeating: false,
    includesPlanterBoxes: false,
    includesPergola: false,
    hasHotTub: false,
    includesScreening: false,
    includesSkirting: false,
    railingType: 'Wood',
    stairCount: 0,
    complexity: 'Standard',
    state: 'GA',
  })

  const deckMaterials = [
    'Pressure Treated', 'Cedar', 'Redwood', 'Composite', 'PVC', 
    'Tropical Hardwood', 'Aluminum', 'Steel'
  ]

  const deckingTypes = ['Composite', 'Wood', 'PVC', 'Aluminum']
  const railingTypes = ['Wood', 'Composite', 'Metal', 'Glass', 'Cable']
  const complexities = ['Standard', 'Complex', 'Custom', 'Luxury']

  const materialPricing: Record<string, any> = {
    'Pressure Treated': { decking: 8, framing: 12, railing: 25 },
    'Cedar': { decking: 15, framing: 18, railing: 35 },
    'Redwood': { decking: 18, framing: 20, railing: 40 },
    'Composite': { decking: 22, framing: 15, railing: 45 },
    'PVC': { decking: 20, framing: 15, railing: 42 },
    'Tropical Hardwood': { decking: 30, framing: 25, railing: 60 },
    'Aluminum': { decking: 28, framing: 22, railing: 55 },
    'Steel': { decking: 25, framing: 20, railing: 50 },
  }

  const calculateEstimate = () => {
    setLoading(true)
    setTimeout(() => {
      const sqFt = form.deckSize || 200
      const height = form.height || 8
      const complexity = form.complexity

      // Base material costs
      const materials = materialPricing[form.material as keyof typeof materialPricing] || materialPricing['Pressure Treated']
      const deckingCost = sqFt * materials.decking
      const framingCost = sqFt * materials.framing * 0.8
      const railingCost = form.includesRails ? (sqFt * 0.3) * materials.railing : 0

      // Additional features
      let stairCost = 0
      let lightingCost = 0
      let seatingCost = 0
      let planterCost = 0
      let pergolaCost = 0
      let hotTubCost = 0
      let screeningCost = 0
      let skirtingCost = 0

      if (form.includesStairs) stairCost = form.stairCount * 800
      if (form.includesLighting) lightingCost = sqFt * 6
      if (form.includesBuiltInSeating) seatingCost = sqFt * 8
      if (form.includesPlanterBoxes) planterCost = sqFt * 4
      if (form.includesPergola) pergolaCost = sqFt * 12
      if (form.hasHotTub) hotTubCost = 3500
      if (form.includesScreening) screeningCost = sqFt * 10
      if (form.includesSkirting) skirtingCost = sqFt * 4

      // Complexity multipliers
      const complexityMultiplier = {
        'Standard': 1.0,
        'Complex': 1.3,
        'Custom': 1.6,
        'Luxury': 2.0
      }[complexity] || 1.0

      // Labor
      const laborRate = complexity === 'Luxury' ? 85 : complexity === 'Custom' ? 75 : 55
      const laborCost = (sqFt / 10) * laborRate * 1.2

      // Total
      const totalMaterials = (deckingCost + framingCost + railingCost + stairCost + 
        lightingCost + seatingCost + planterCost + pergolaCost + 
        hotTubCost + screeningCost + skirtingCost) * complexityMultiplier

      const totalLabor = laborCost * complexityMultiplier
      const overhead = totalMaterials * 0.15
      const profit = (totalMaterials + totalLabor + overhead) * 0.10
      const grandTotal = totalMaterials + totalLabor + overhead + profit

      setEstimate({
        summary: {
          sqFt,
          height,
          complexity,
          totalMaterials,
          totalLabor,
          overhead,
          profit,
          grandTotal,
          perSqFt: grandTotal / sqFt,
        },
        breakdown: {
          decking: { cost: deckingCost * complexityMultiplier, sqFt, pricePerSq: materials.decking },
          framing: { cost: framingCost * complexityMultiplier, sqFt: sqFt * 0.8, pricePerSq: materials.framing },
          railing: { cost: railingCost * complexityMultiplier, included: form.includesRails },
          stairs: { cost: stairCost * complexityMultiplier, included: form.includesStairs, count: form.stairCount },
          lighting: { cost: lightingCost * complexityMultiplier, included: form.includesLighting },
          seating: { cost: seatingCost * complexityMultiplier, included: form.includesBuiltInSeating },
          planters: { cost: planterCost * complexityMultiplier, included: form.includesPlanterBoxes },
          pergola: { cost: pergolaCost * complexityMultiplier, included: form.includesPergola },
          hotTub: { cost: hotTubCost * complexityMultiplier, included: form.hasHotTub },
          screening: { cost: screeningCost * complexityMultiplier, included: form.includesScreening },
          skirting: { cost: skirtingCost * complexityMultiplier, included: form.includesSkirting },
        },
        labor: {
          rate: laborRate,
          hours: (sqFt / 10) * 1.2,
          total: totalLabor,
        },
        features: {
          material: form.material,
          deckingType: form.deckingType,
          railingType: form.railingType,
          complexity: form.complexity,
          includesRails: form.includesRails,
          includesStairs: form.includesStairs,
          includesLighting: form.includesLighting,
          includesSeating: form.includesBuiltInSeating,
          includesPlanterBoxes: form.includesPlanterBoxes,
          includesPergola: form.includesPergola,
          hasHotTub: form.hasHotTub,
          includesScreening: form.includesScreening,
          includesSkirting: form.includesSkirting,
        }
      })

      setLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🪵 Deck Estimator</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">PRO</span>
        </div>
      </header>

      <main className="p-4">
        {/* Inputs */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-amber-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Deck Size (sq ft)</label>
              <input
                type="number"
                value={form.deckSize || ''}
                onChange={(e) => setForm({...form, deckSize: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Height (ft)</label>
              <input
                type="number"
                value={form.height || ''}
                onChange={(e) => setForm({...form, height: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="8"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.material}
                onChange={(e) => setForm({...form, material: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {deckMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Complexity</label>
              <select
                value={form.complexity}
                onChange={(e) => setForm({...form, complexity: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {complexities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-amber-200">
          <h3 className="font-semibold text-sm mb-2">🛠️ Features</h3>
          <div className="grid grid-cols-2 gap-1">
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesRails} onChange={(e) => setForm({...form, includesRails: e.target.checked})} className="mr-1" /> Railing</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesStairs} onChange={(e) => setForm({...form, includesStairs: e.target.checked})} className="mr-1" /> Stairs</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesLighting} onChange={(e) => setForm({...form, includesLighting: e.target.checked})} className="mr-1" /> Lighting</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesBuiltInSeating} onChange={(e) => setForm({...form, includesBuiltInSeating: e.target.checked})} className="mr-1" /> Seating</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesPlanterBoxes} onChange={(e) => setForm({...form, includesPlanterBoxes: e.target.checked})} className="mr-1" /> Planters</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesPergola} onChange={(e) => setForm({...form, includesPergola: e.target.checked})} className="mr-1" /> Pergola</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.hasHotTub} onChange={(e) => setForm({...form, hasHotTub: e.target.checked})} className="mr-1" /> Hot Tub Base</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesScreening} onChange={(e) => setForm({...form, includesScreening: e.target.checked})} className="mr-1" /> Screening</label>
          </div>
        </div>

        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '🪵 Auto Estimate Deck'}
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-lg p-4 border border-amber-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Grand Total</p>
                  <p className="text-2xl font-bold text-amber-600">${estimate.summary.grandTotal.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Per Sq Ft</p>
                  <p className="text-xl font-bold text-orange-600">${estimate.summary.perSqFt.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Sq Ft</p>
                  <p className="text-xl font-bold text-green-600">{estimate.summary.sqFt}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-amber-200">
              <h3 className="font-semibold text-sm mb-2">📊 Breakdown</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-sm border-b py-1">
                  <span>Decking</span>
                  <span>${estimate.breakdown.decking.cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-b py-1">
                  <span>Framing</span>
                  <span>${estimate.breakdown.framing.cost.toFixed(2)}</span>
                </div>
                {estimate.breakdown.railing.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Railing</span>
                    <span>${estimate.breakdown.railing.cost.toFixed(2)}</span>
                  </div>
                )}
                {estimate.breakdown.stairs.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Stairs ({estimate.breakdown.stairs.count})</span>
                    <span>${estimate.breakdown.stairs.cost.toFixed(2)}</span>
                  </div>
                )}
                {estimate.breakdown.lighting.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Lighting</span>
                    <span>${estimate.breakdown.lighting.cost.toFixed(2)}</span>
                  </div>
                )}
                {estimate.breakdown.seating.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Seating</span>
                    <span>${estimate.breakdown.seating.cost.toFixed(2)}</span>
                  </div>
                )}
                {estimate.breakdown.planters.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Planters</span>
                    <span>${estimate.breakdown.planters.cost.toFixed(2)}</span>
                  </div>
                )}
                {estimate.breakdown.pergola.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Pergola</span>
                    <span>${estimate.breakdown.pergola.cost.toFixed(2)}</span>
                  </div>
                )}
                {estimate.breakdown.hotTub.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Hot Tub Base</span>
                    <span>${estimate.breakdown.hotTub.cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2">
                  <span>Total Materials</span>
                  <span>${estimate.summary.totalMaterials.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Labor ({estimate.labor.hours.toFixed(0)} hrs @ ${estimate.labor.rate}/hr)</span>
                  <span>${estimate.summary.totalLabor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 font-bold text-lg">
                  <span>Grand Total</span>
                  <span className="text-amber-600">${estimate.summary.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold">
                ✉️ Send Estimate
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/deck')} className="flex flex-col items-center text-amber-600">
          <span className="text-xl">🪵</span>
          <span className="text-xs">Deck</span>
        </button>
        <button onClick={() => router.push('/repair')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔧</span>
          <span className="text-xs">Repair</span>
        </button>
        <button onClick={() => router.push('/exterior')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Exterior</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
