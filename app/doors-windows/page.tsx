'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DoorsWindowsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])

  const [form, setForm] = useState({
    windows: {
      count: 0,
      type: 'Double Hung',
      material: 'Vinyl',
      size: '36x54',
      hasGrids: false,
      hasLowE: true,
      hasArgon: true,
      isImpact: false,
    },
    doors: {
      count: 0,
      type: 'Entry Door',
      material: 'Steel',
      size: '36x80',
      hasSidelites: false,
      hasTransom: false,
      isFrench: false,
      isSliding: false,
      isPatio: false,
    },
    garage: {
      count: 0,
      type: 'Sectional',
      material: 'Steel',
      size: '16x7',
      hasWindows: false,
      hasInsulation: true,
      hasOpener: true,
    },
  })

  const windowTypes = ['Double Hung', 'Casement', 'Slider', 'Awning', 'Bay', 'Bow', 'Picture']
  const windowMaterials = ['Vinyl', 'Wood', 'Aluminum', 'Fiberglass', 'Composite', 'Steel']
  const doorTypes = ['Entry Door', 'French Door', 'Sliding Door', 'Patio Door', 'Storm Door', 'Screen Door']
  const doorMaterials = ['Steel', 'Wood', 'Fiberglass', 'Aluminum', 'Glass', 'Iron']
  const garageTypes = ['Sectional', 'Roll-up', 'Tilt-up', 'Side-hinged']
  const garageMaterials = ['Steel', 'Wood', 'Aluminum', 'Fiberglass']

  const windowSizes = ['24x36', '30x48', '32x50', '36x54', '42x60', '48x72']
  const doorSizes = ['30x80', '32x80', '34x80', '36x80', '42x84', '48x96']
  const garageSizes = ['14x7', '16x7', '18x8', '20x8', '24x8', '30x10']

  const calculateEstimate = () => {
    setLoading(true)

    setTimeout(() => {
      // Window calculations
      const windowPrices = {
        'Double Hung': { 'Vinyl': 450, 'Wood': 800, 'Aluminum': 350, 'Fiberglass': 700, 'Composite': 600, 'Steel': 550 },
        'Casement': { 'Vinyl': 500, 'Wood': 900, 'Aluminum': 400, 'Fiberglass': 750, 'Composite': 650, 'Steel': 600 },
        'Slider': { 'Vinyl': 400, 'Wood': 750, 'Aluminum': 350, 'Fiberglass': 650, 'Composite': 550, 'Steel': 500 },
        'Awning': { 'Vinyl': 480, 'Wood': 850, 'Aluminum': 380, 'Fiberglass': 720, 'Composite': 620, 'Steel': 570 },
        'Bay': { 'Vinyl': 1200, 'Wood': 2000, 'Aluminum': 1100, 'Fiberglass': 1800, 'Composite': 1600, 'Steel': 1400 },
        'Bow': { 'Vinyl': 1500, 'Wood': 2500, 'Aluminum': 1400, 'Fiberglass': 2200, 'Composite': 2000, 'Steel': 1800 },
        'Picture': { 'Vinyl': 350, 'Wood': 700, 'Aluminum': 300, 'Fiberglass': 600, 'Composite': 500, 'Steel': 450 },
      }

      const doorPrices = {
        'Entry Door': { 'Steel': 800, 'Wood': 1500, 'Fiberglass': 1200, 'Aluminum': 900, 'Glass': 1800, 'Iron': 2000 },
        'French Door': { 'Steel': 1200, 'Wood': 2000, 'Fiberglass': 1600, 'Aluminum': 1400, 'Glass': 2200, 'Iron': 2500 },
        'Sliding Door': { 'Steel': 1000, 'Wood': 1800, 'Fiberglass': 1400, 'Aluminum': 1100, 'Glass': 1600, 'Iron': 1900 },
        'Patio Door': { 'Steel': 1100, 'Wood': 1900, 'Fiberglass': 1500, 'Aluminum': 1200, 'Glass': 1700, 'Iron': 2000 },
        'Storm Door': { 'Steel': 400, 'Wood': 600, 'Fiberglass': 500, 'Aluminum': 350, 'Glass': 700, 'Iron': 800 },
        'Screen Door': { 'Steel': 200, 'Wood': 300, 'Fiberglass': 250, 'Aluminum': 180, 'Glass': 350, 'Iron': 400 },
      }

      const garagePrices = {
        'Sectional': { 'Steel': 1200, 'Wood': 1800, 'Aluminum': 1400, 'Fiberglass': 1600 },
        'Roll-up': { 'Steel': 1500, 'Wood': 2000, 'Aluminum': 1600, 'Fiberglass': 1800 },
        'Tilt-up': { 'Steel': 1000, 'Wood': 1600, 'Aluminum': 1200, 'Fiberglass': 1400 },
        'Side-hinged': { 'Steel': 900, 'Wood': 1400, 'Aluminum': 1100, 'Fiberglass': 1300 },
      }

      // Window calculation
      const wCount = form.windows.count || 0
      const wType = form.windows.type
      const wMaterial = form.windows.material
      const wBasePrice = windowPrices[wType as keyof typeof windowPrices]?.[wMaterial as keyof typeof windowPrices['Double Hung']] || 450
      let wCost = wCount * wBasePrice
      
      // Add window options
      if (form.windows.hasGrids) wCost += wCount * 50
      if (form.windows.hasLowE) wCost += wCount * 75
      if (form.windows.hasArgon) wCost += wCount * 60
      if (form.windows.isImpact) wCost += wCount * 200

      // Door calculation
      const dCount = form.doors.count || 0
      const dType = form.doors.type
      const dMaterial = form.doors.material
      const dBasePrice = doorPrices[dType as keyof typeof doorPrices]?.[dMaterial as keyof typeof doorPrices['Entry Door']] || 800
      let dCost = dCount * dBasePrice

      if (form.doors.hasSidelites) dCost += dCount * 400
      if (form.doors.hasTransom) dCost += dCount * 300
      if (form.doors.isFrench) dCost += dCount * 200
      if (form.doors.isSliding) dCost += dCount * 150
      if (form.doors.isPatio) dCost += dCount * 250

      // Garage door calculation
      const gCount = form.garage.count || 0
      const gType = form.garage.type
      const gMaterial = form.garage.material
      const gBasePrice = garagePrices[gType as keyof typeof garagePrices]?.[gMaterial as keyof typeof garagePrices['Sectional']] || 1200
      let gCost = gCount * gBasePrice

      if (form.garage.hasWindows) gCost += gCount * 300
      if (form.garage.hasInsulation) gCost += gCount * 200
      if (form.garage.hasOpener) gCost += gCount * 400

      // Labor costs
      const wLabor = wCount * 150
      const dLabor = dCount * 200
      const gLabor = gCount * 250

      // Total
      const totalMaterials = wCost + dCost + gCost
      const totalLabor = wLabor + dLabor + gLabor
      const overhead = totalMaterials * 0.15
      const profit = (totalMaterials + totalLabor + overhead) * 0.10
      const grandTotal = totalMaterials + totalLabor + overhead + profit

      setEstimate({
        windows: {
          count: wCount,
          type: wType,
          material: wMaterial,
          size: form.windows.size,
          cost: wCost,
          options: {
            grids: form.windows.hasGrids,
            lowE: form.windows.hasLowE,
            argon: form.windows.hasArgon,
            impact: form.windows.isImpact,
          },
          labor: wLabor,
        },
        doors: {
          count: dCount,
          type: dType,
          material: dMaterial,
          size: form.doors.size,
          cost: dCost,
          options: {
            sidelites: form.doors.hasSidelites,
            transom: form.doors.hasTransom,
            french: form.doors.isFrench,
            sliding: form.doors.isSliding,
            patio: form.doors.isPatio,
          },
          labor: dLabor,
        },
        garage: {
          count: gCount,
          type: gType,
          material: gMaterial,
          size: form.garage.size,
          cost: gCost,
          options: {
            windows: form.garage.hasWindows,
            insulation: form.garage.hasInsulation,
            opener: form.garage.hasOpener,
          },
          labor: gLabor,
        },
        totalMaterials,
        totalLabor,
        overhead,
        profit,
        grandTotal,
        perUnit: {
          windows: wCount > 0 ? wCost / wCount : 0,
          doors: dCount > 0 ? dCost / dCount : 0,
          garage: gCount > 0 ? gCost / gCount : 0,
        }
      })

      setLoading(false)
    }, 1500)
  }

  const formatCurrency = (num: number) => {
    return '$' + num.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🚪 Doors & Windows</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">AUTO</span>
        </div>
      </header>

      <main className="p-4">
        {/* Windows Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🪟</span> Windows
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Count</label>
              <input
                type="number"
                value={form.windows.count || ''}
                onChange={(e) => setForm({...form, windows: {...form.windows, count: Number(e.target.value)}})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={form.windows.type}
                onChange={(e) => setForm({...form, windows: {...form.windows, type: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {windowTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.windows.material}
                onChange={(e) => setForm({...form, windows: {...form.windows, material: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {windowMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Size</label>
              <select
                value={form.windows.size}
                onChange={(e) => setForm({...form, windows: {...form.windows, size: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {windowSizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.hasGrids}
                  onChange={(e) => setForm({...form, windows: {...form.windows, hasGrids: e.target.checked}})}
                  className="mr-1"
                /> Grids
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.hasLowE}
                  onChange={(e) => setForm({...form, windows: {...form.windows, hasLowE: e.target.checked}})}
                  className="mr-1"
                /> Low-E
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.hasArgon}
                  onChange={(e) => setForm({...form, windows: {...form.windows, hasArgon: e.target.checked}})}
                  className="mr-1"
                /> Argon
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.isImpact}
                  onChange={(e) => setForm({...form, windows: {...form.windows, isImpact: e.target.checked}})}
                  className="mr-1"
                /> Impact
              </label>
            </div>
          </div>
        </div>

        {/* Doors Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-green-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🚪</span> Doors
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Count</label>
              <input
                type="number"
                value={form.doors.count || ''}
                onChange={(e) => setForm({...form, doors: {...form.doors, count: Number(e.target.value)}})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={form.doors.type}
                onChange={(e) => setForm({...form, doors: {...form.doors, type: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {doorTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.doors.material}
                onChange={(e) => setForm({...form, doors: {...form.doors, material: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {doorMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Size</label>
              <select
                value={form.doors.size}
                onChange={(e) => setForm({...form, doors: {...form.doors, size: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {doorSizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.hasSidelites}
                  onChange={(e) => setForm({...form, doors: {...form.doors, hasSidelites: e.target.checked}})}
                  className="mr-1"
                /> Sidelites
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.hasTransom}
                  onChange={(e) => setForm({...form, doors: {...form.doors, hasTransom: e.target.checked}})}
                  className="mr-1"
                /> Transom
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.isFrench}
                  onChange={(e) => setForm({...form, doors: {...form.doors, isFrench: e.target.checked}})}
                  className="mr-1"
                /> French
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.isSliding}
                  onChange={(e) => setForm({...form, doors: {...form.doors, isSliding: e.target.checked}})}
                  className="mr-1"
                /> Sliding
              </label>
              <label className="flex items-center text-xs col-span-2">
                <input
                  type="checkbox"
                  checked={form.doors.isPatio}
                  onChange={(e) => setForm({...form, doors: {...form.doors, isPatio: e.target.checked}})}
                  className="mr-1"
                /> Patio Door
              </label>
            </div>
          </div>
        </div>

        {/* Garage Doors Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-yellow-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🏗️</span> Garage Doors
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Count</label>
              <input
                type="number"
                value={form.garage.count || ''}
                onChange={(e) => setForm({...form, garage: {...form.garage, count: Number(e.target.value)}})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={form.garage.type}
                onChange={(e) => setForm({...form, garage: {...form.garage, type: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {garageTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.garage.material}
                onChange={(e) => setForm({...form, garage: {...form.garage, material: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {garageMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Size</label>
              <select
                value={form.garage.size}
                onChange={(e) => setForm({...form, garage: {...form.garage, size: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {garageSizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.garage.hasWindows}
                  onChange={(e) => setForm({...form, garage: {...form.garage, hasWindows: e.target.checked}})}
                  className="mr-1"
                /> Windows
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.garage.hasInsulation}
                  onChange={(e) => setForm({...form, garage: {...form.garage, hasInsulation: e.target.checked}})}
                  className="mr-1"
                /> Insulated
              </label>
              <label className="flex items-center text-xs col-span-2">
                <input
                  type="checkbox"
                  checked={form.garage.hasOpener}
                  onChange={(e) => setForm({...form, garage: {...form.garage, hasOpener: e.target.checked}})}
                  className="mr-1"
                /> With Opener
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '🚪 Auto Estimate Doors & Windows'}
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 border border-blue-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Grand Total</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(estimate.grandTotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Materials</p>
                  <p className="text-xl font-bold text-purple-600">{formatCurrency(estimate.totalMaterials)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Labor</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(estimate.totalLabor)}</p>
                </div>
              </div>
            </div>

            {/* Windows Detail */}
            {estimate.windows.count > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
                <h4 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🪟</span> Windows ({estimate.windows.count})
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {estimate.windows.type}</div>
                  <div><span className="text-gray-500">Material:</span> {estimate.windows.material}</div>
                  <div><span className="text-gray-500">Size:</span> {estimate.windows.size}</div>
                  <div><span className="text-gray-500">Options:</span> {
                    Object.entries(estimate.windows.options)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'None'
                  }</div>
                  <div><span className="text-gray-500">Materials:</span> {formatCurrency(estimate.windows.cost)}</div>
                  <div><span className="text-gray-500">Labor:</span> {formatCurrency(estimate.windows.labor)}</div>
                </div>
              </div>
            )}

            {/* Doors Detail */}
            {estimate.doors.count > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-green-500">
                <h4 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🚪</span> Doors ({estimate.doors.count})
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {estimate.doors.type}</div>
                  <div><span className="text-gray-500">Material:</span> {estimate.doors.material}</div>
                  <div><span className="text-gray-500">Size:</span> {estimate.doors.size}</div>
                  <div><span className="text-gray-500">Options:</span> {
                    Object.entries(estimate.doors.options)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'None'
                  }</div>
                  <div><span className="text-gray-500">Materials:</span> {formatCurrency(estimate.doors.cost)}</div>
                  <div><span className="text-gray-500">Labor:</span> {formatCurrency(estimate.doors.labor)}</div>
                </div>
              </div>
            )}

            {/* Garage Detail */}
            {estimate.garage.count > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-yellow-500">
                <h4 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🏗️</span> Garage Doors ({estimate.garage.count})
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {estimate.garage.type}</div>
                  <div><span className="text-gray-500">Material:</span> {estimate.garage.material}</div>
                  <div><span className="text-gray-500">Size:</span> {estimate.garage.size}</div>
                  <div><span className="text-gray-500">Options:</span> {
                    Object.entries(estimate.garage.options)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'None'
                  }</div>
                  <div><span className="text-gray-500">Materials:</span> {formatCurrency(estimate.garage.cost)}</div>
                  <div><span className="text-gray-500">Labor:</span> {formatCurrency(estimate.garage.labor)}</div>
                </div>
              </div>
            )}

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
        <button onClick={() => router.push('/doors-windows')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🚪</span>
          <span className="text-xs">Doors</span>
        </button>
        <button onClick={() => router.push('/exterior')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Exterior</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
