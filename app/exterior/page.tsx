'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ExteriorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [measurements, setMeasurements] = useState({
    linearFeet: 0,
    stories: 2,
    gutterType: 'Seamless Aluminum',
    downspouts: 0,
    hasGuards: true,
    hasCovers: false,
    hasCopper: false,
    hasSoffit: true,
    hasFascia: true,
    hasChimney: true,
    chimneyCount: 1,
    chimneyHeight: 20,
  })

  const [estimate, setEstimate] = useState<any>(null)
  const [saveMessage, setSaveMessage] = useState('')

  const gutterTypes = [
    'Seamless Aluminum',
    'Copper',
    'Steel',
    'Vinyl',
    'Zinc'
  ]

  const calculateEstimate = () => {
    setLoading(true)
    
    setTimeout(() => {
      const linearFeet = measurements.linearFeet || 100
      const stories = measurements.stories || 2
      const downspouts = measurements.downspouts || Math.ceil(linearFeet / 40)
      
      // Pricing calculations
      const gutterPricing = {
        'Seamless Aluminum': 6.50,
        'Copper': 18.00,
        'Steel': 8.00,
        'Vinyl': 4.50,
        'Zinc': 14.00
      }
      
      const baseGutterPrice = gutterPricing[measurements.gutterType as keyof typeof gutterPricing] || 6.50
      const gutterCost = linearFeet * baseGutterPrice
      const downspoutCost = downspouts * 45
      const laborCost = linearFeet * 3.50
      
      // Additional components
      let guardCost = 0
      let coverCost = 0
      let copperCost = 0
      let soffitCost = 0
      let fasciaCost = 0
      let chimneyCost = 0
      
      if (measurements.hasGuards) guardCost = linearFeet * 4.00
      if (measurements.hasCovers) coverCost = linearFeet * 3.00
      if (measurements.hasCopper) copperCost = linearFeet * 2.50
      if (measurements.hasSoffit) soffitCost = linearFeet * 8.00
      if (measurements.hasFascia) fasciaCost = linearFeet * 7.00
      
      if (measurements.hasChimney) {
        chimneyCost = measurements.chimneyCount * (measurements.chimneyHeight * 25 + 500)
      }
      
      const totalMaterials = gutterCost + downspoutCost + guardCost + coverCost + copperCost + soffitCost + fasciaCost + chimneyCost
      const totalLabor = laborCost + (measurements.hasChimney ? measurements.chimneyCount * 300 : 0)
      const overhead = totalMaterials * 0.15
      const profit = (totalMaterials + totalLabor + overhead) * 0.10
      const total = totalMaterials + totalLabor + overhead + profit
      
      setEstimate({
        breakdown: [
          { item: 'Gutters', cost: gutterCost, unit: 'linear ft', quantity: linearFeet, price: baseGutterPrice },
          { item: 'Downspouts', cost: downspoutCost, unit: 'each', quantity: downspouts, price: 45 },
          { item: 'Gutter Guards', cost: guardCost, unit: 'linear ft', quantity: linearFeet, price: 4.00 },
          { item: 'Gutter Covers', cost: coverCost, unit: 'linear ft', quantity: linearFeet, price: 3.00 },
          { item: 'Copper Accents', cost: copperCost, unit: 'linear ft', quantity: linearFeet, price: 2.50 },
          { item: 'Soffit', cost: soffitCost, unit: 'linear ft', quantity: linearFeet, price: 8.00 },
          { item: 'Fascia', cost: fasciaCost, unit: 'linear ft', quantity: linearFeet, price: 7.00 },
          { item: 'Chimney Work', cost: chimneyCost, unit: 'each', quantity: measurements.chimneyCount, price: 'varies' },
          { item: 'Labor', cost: totalLabor, unit: 'hours', quantity: Math.round(totalLabor / 55), price: 55 },
        ],
        totalMaterials: totalMaterials,
        totalLabor: totalLabor,
        overhead: overhead,
        profit: profit,
        grandTotal: total,
        perLinearFoot: total / linearFeet,
        squareFootage: linearFeet * 0.5,
      })
      
      setLoading(false)
    }, 2000)
  }

  const formatCurrency = (num: number) => {
    return '$' + num.toFixed(2)
  }

  const saveMeasurement = async () => {
    const response = await fetch('/api/measurements/manual', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gutterLf: measurements.linearFeet, notes: 'Exterior estimator manual capture; roof geometry requires separate review.' }),
    })
    const result = await response.json()
    setSaveMessage(response.ok ? `Saved measurement ${result.measurement.id}; it remains unverified until review.` : (result.error ?? 'Could not save measurement.'))
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🏠 Exterior Estimating</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">AUTO</span>
        </div>
      </header>

      <main className="p-4">
        {/* Measurements Input */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">📐 Measurements</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Linear Feet</label>
              <input
                type="number"
                value={measurements.linearFeet || ''}
                onChange={(e) => setMeasurements({...measurements, linearFeet: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="100"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Stories</label>
              <select
                value={measurements.stories}
                onChange={(e) => setMeasurements({...measurements, stories: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                <option value={1}>1 Story</option>
                <option value={2}>2 Story</option>
                <option value={3}>3 Story</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Gutter Type</label>
              <select
                value={measurements.gutterType}
                onChange={(e) => setMeasurements({...measurements, gutterType: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {gutterTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Downspouts (auto-calc)</label>
              <input
                type="number"
                value={measurements.downspouts || ''}
                onChange={(e) => setMeasurements({...measurements, downspouts: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="Auto"
              />
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">🔄 Additional Components</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={measurements.hasGuards}
                onChange={(e) => setMeasurements({...measurements, hasGuards: e.target.checked})}
                className="mr-2"
              />
              Gutter Guards
            </label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={measurements.hasCovers}
                onChange={(e) => setMeasurements({...measurements, hasCovers: e.target.checked})}
                className="mr-2"
              />
              Gutter Covers
            </label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={measurements.hasCopper}
                onChange={(e) => setMeasurements({...measurements, hasCopper: e.target.checked})}
                className="mr-2"
              />
              Copper Accents
            </label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={measurements.hasSoffit}
                onChange={(e) => setMeasurements({...measurements, hasSoffit: e.target.checked})}
                className="mr-2"
              />
              Soffit
            </label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={measurements.hasFascia}
                onChange={(e) => setMeasurements({...measurements, hasFascia: e.target.checked})}
                className="mr-2"
              />
              Fascia
            </label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={measurements.hasChimney}
                onChange={(e) => setMeasurements({...measurements, hasChimney: e.target.checked})}
                className="mr-2"
              />
              Chimney
            </label>
          </div>
          {measurements.hasChimney && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-gray-500">Number of Chimneys</label>
                <input
                  type="number"
                  value={measurements.chimneyCount}
                  onChange={(e) => setMeasurements({...measurements, chimneyCount: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Chimney Height (ft)</label>
                <input
                  type="number"
                  value={measurements.chimneyHeight}
                  onChange={(e) => setMeasurements({...measurements, chimneyHeight: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {saveMessage && <p className="text-sm text-blue-700 mb-3" role="status">{saveMessage}</p>}
        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '📊 Auto Estimate Exterior'}
        </button>
        <button onClick={() => void saveMeasurement()} className="w-full mt-2 border border-blue-600 text-blue-700 py-3 rounded-lg font-semibold">
          Save Measurement for Review
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-lg p-4 border border-blue-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Estimate</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(estimate.grandTotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Per Linear Ft</p>
                  <p className="text-xl font-bold text-cyan-600">{formatCurrency(estimate.perLinearFoot)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Sq Ft</p>
                  <p className="text-xl font-bold text-green-600">{estimate.squareFootage.toFixed(0)}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-sm mb-3">📋 Cost Breakdown</h3>
              <div className="space-y-2">
                {estimate.breakdown.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.item}</p>
                      <p className="text-xs text-gray-400">
                        {item.quantity} {item.unit} @ {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-bold">{formatCurrency(item.cost)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-blue-300">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Materials</span>
                  <span>{formatCurrency(estimate.totalMaterials)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Labor</span>
                  <span>{formatCurrency(estimate.totalLabor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Overhead (15%)</span>
                  <span>{formatCurrency(estimate.overhead)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Profit (10%)</span>
                  <span>{formatCurrency(estimate.profit)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Grand Total</span>
                  <span className="text-blue-600">{formatCurrency(estimate.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
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
        <button onClick={() => router.push('/exterior')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Exterior</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/estimate')} className="flex flex-col items-center text-gray-400">
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
