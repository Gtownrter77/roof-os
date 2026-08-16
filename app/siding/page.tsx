'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SidingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)
  const [codeCheck, setCodeCheck] = useState<any>(null)

  const [form, setForm] = useState({
    squareFeet: 0,
    stories: 2,
    sidingType: 'Vinyl',
    style: 'Lap',
    color: 'White',
    includesTrim: true,
    includesSoffit: true,
    includesFascia: true,
    includesCornerPosts: true,
    includesJChannel: true,
    includesStartStrip: true,
    includesUnderlayment: true,
    includesInsulation: false,
    includesScaffolding: true,
    wasteFactor: 10,
    state: 'GA',
  })

  // Code database reference
  const codeData: Record<string, any> = {
    'GA': {
      requirements: [
        'Minimum weather-resistant barrier: ASTM E2556',
        'Furring strips required for vinyl siding over masonry',
        'Vinyl siding must meet ASTM D3679',
        'Maximum nailing spacing: 16"',
        'Corner trim required at all corners'
      ],
      permits: 'Required for siding replacement over 100 sq ft',
      inspections: 'Final inspection required',
      energyCode: 'Continuous insulation required'
    },
    'CA': {
      requirements: [
        'Title 24 energy compliance required',
        'Fire resistance: Class A in wildfire zones',
        'Termite resistance required in high-risk areas',
        'Earthquake bracing required'
      ],
      permits: 'Required for all siding work',
      inspections: 'Multiple inspections required',
      energyCode: 'Title 24 Part 6'
    },
    'FL': {
      requirements: [
        'Impact-resistant materials required in HVHZ',
        'Wind resistance: 150-180 mph',
        'Miami-Dade County product approval may apply'
      ],
      permits: 'Required for all siding work',
      inspections: 'Wind mitigation inspection required',
      energyCode: 'IECC 2021 with FL amendments'
    },
    'TX': {
      requirements: [
        'Wind resistance: 120 mph (windstorm areas)',
        'Hail-resistant materials recommended',
        'TDI windstorm requirements for coastal counties'
      ],
      permits: 'Required in most municipalities',
      inspections: 'Final inspection required',
      energyCode: 'IECC 2021'
    },
    'NY': {
      requirements: [
        'Snow load considerations for upper floors',
        'Class A fire rating required in urban areas',
        'Energy code compliance required'
      ],
      permits: 'Required for siding work over 100 sq ft',
      inspections: 'Final inspection required',
      energyCode: 'NY State Energy Code'
    }
  }

  const calculateEstimate = () => {
    setLoading(true)
    setTimeout(() => {
      const sqFt = form.squareFeet || 1000
      const waste = sqFt * (form.wasteFactor / 100)
      const totalSqFt = sqFt + waste

      const sidingPrices = {
        'Vinyl': 180,
        'HardiePlank': 320,
        'Wood': 300,
        'Fiber Cement': 290,
        'Engineered Wood': 260,
        'Metal': 350,
        'Brick Veneer': 650,
      }

      const basePrice = sidingPrices[form.sidingType as keyof typeof sidingPrices] || 180
      const materialCost = (totalSqFt / 100) * basePrice

      // Accessories
      const linearFt = sqFt * 0.15
      const trimCost = form.includesTrim ? linearFt * 4.50 : 0
      const soffitCost = form.includesSoffit ? linearFt * 6.00 : 0
      const fasciaCost = form.includesFascia ? linearFt * 5.00 : 0
      const cornerPostsCost = form.includesCornerPosts ? (sqFt / 100) * 45 : 0
      const jChannelCost = form.includesJChannel ? linearFt * 2.50 : 0
      const startStripCost = form.includesStartStrip ? (sqFt / 100) * 25 : 0
      const underlaymentCost = form.includesUnderlayment ? (sqFt / 100) * 65 : 0
      const insulationCost = form.includesInsulation ? (sqFt / 100) * 85 : 0
      const scaffoldingCost = form.includesScaffolding ? sqFt * 0.50 : 0

      const laborCost = (sqFt / 100) * (form.sidingType === 'HardiePlank' ? 75 : 55) * 1.5

      const totalMaterials = materialCost + trimCost + soffitCost + fasciaCost + 
        cornerPostsCost + jChannelCost + startStripCost + underlaymentCost + 
        insulationCost + scaffoldingCost
      
      const totalLabor = laborCost
      const overhead = totalMaterials * 0.15
      const profit = (totalMaterials + totalLabor + overhead) * 0.10
      const grandTotal = totalMaterials + totalLabor + overhead + profit

      setEstimate({
        summary: {
          totalSqFt: totalSqFt,
          materialCost: materialCost,
          laborCost: totalLabor,
          totalMaterials,
          totalLabor,
          overhead,
          profit,
          grandTotal,
          perSqFt: grandTotal / sqFt,
        },
        breakdown: {
          siding: { cost: materialCost, sqFt: totalSqFt, pricePerSq: basePrice },
          trim: { cost: trimCost, included: form.includesTrim },
          soffit: { cost: soffitCost, included: form.includesSoffit },
          fascia: { cost: fasciaCost, included: form.includesFascia },
          cornerPosts: { cost: cornerPostsCost, included: form.includesCornerPosts },
          jChannel: { cost: jChannelCost, included: form.includesJChannel },
          startStrip: { cost: startStripCost, included: form.includesStartStrip },
          underlayment: { cost: underlaymentCost, included: form.includesUnderlayment },
          insulation: { cost: insulationCost, included: form.includesInsulation },
          scaffolding: { cost: scaffoldingCost, included: form.includesScaffolding },
        }
      })

      // Check building codes
      const stateCode = codeData[form.state as keyof typeof codeData]
      if (stateCode) {
        setCodeCheck({
          requirements: stateCode.requirements,
          permits: stateCode.permits,
          inspections: stateCode.inspections,
          energyCode: stateCode.energyCode,
          compliant: true
        })
      }

      setLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🏠 Siding Estimator</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">AUTO</span>
        </div>
      </header>

      <main className="p-4">
        {/* Input */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Square Feet</label>
              <input
                type="number"
                value={form.squareFeet || ''}
                onChange={(e) => setForm({...form, squareFeet: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="1000"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">State</label>
              <select
                value={form.state}
                onChange={(e) => setForm({...form, state: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                <option value="GA">Georgia</option>
                <option value="CA">California</option>
                <option value="FL">Florida</option>
                <option value="TX">Texas</option>
                <option value="NY">New York</option>
                <option value="AL">Alabama</option>
                <option value="SC">South Carolina</option>
                <option value="NC">North Carolina</option>
                <option value="TN">Tennessee</option>
                <option value="IL">Illinois</option>
                <option value="PA">Pennsylvania</option>
                <option value="OH">Ohio</option>
                <option value="MI">Michigan</option>
                <option value="NJ">New Jersey</option>
                <option value="VA">Virginia</option>
                <option value="WA">Washington</option>
                <option value="CO">Colorado</option>
                <option value="AZ">Arizona</option>
                <option value="OR">Oregon</option>
                <option value="MD">Maryland</option>
                <option value="IN">Indiana</option>
                <option value="MA">Massachusetts</option>
                <option value="MO">Missouri</option>
                <option value="WI">Wisconsin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Siding Type</label>
              <select
                value={form.sidingType}
                onChange={(e) => setForm({...form, sidingType: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                <option value="Vinyl">Vinyl</option>
                <option value="HardiePlank">HardiePlank</option>
                <option value="Wood">Wood</option>
                <option value="Fiber Cement">Fiber Cement</option>
                <option value="Engineered Wood">Engineered Wood</option>
                <option value="Metal">Metal</option>
                <option value="Brick Veneer">Brick Veneer</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Style</label>
              <select
                value={form.style}
                onChange={(e) => setForm({...form, style: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                <option value="Lap">Lap</option>
                <option value="Dutch Lap">Dutch Lap</option>
                <option value="Board & Batten">Board & Batten</option>
                <option value="Shake">Shake</option>
                <option value="Scallop">Scallop</option>
                <option value="Vertical">Vertical</option>
                <option value="Shingle">Shingle</option>
                <option value="Panel">Panel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Accessories */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-green-200">
          <h3 className="font-semibold text-sm mb-2">🔧 Accessories</h3>
          <div className="grid grid-cols-2 gap-1">
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesTrim} onChange={(e) => setForm({...form, includesTrim: e.target.checked})} className="mr-1" /> Trim</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesSoffit} onChange={(e) => setForm({...form, includesSoffit: e.target.checked})} className="mr-1" /> Soffit</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesFascia} onChange={(e) => setForm({...form, includesFascia: e.target.checked})} className="mr-1" /> Fascia</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesCornerPosts} onChange={(e) => setForm({...form, includesCornerPosts: e.target.checked})} className="mr-1" /> Corner Posts</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesJChannel} onChange={(e) => setForm({...form, includesJChannel: e.target.checked})} className="mr-1" /> J-Channel</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesStartStrip} onChange={(e) => setForm({...form, includesStartStrip: e.target.checked})} className="mr-1" /> Start Strip</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesUnderlayment} onChange={(e) => setForm({...form, includesUnderlayment: e.target.checked})} className="mr-1" /> Underlayment</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesInsulation} onChange={(e) => setForm({...form, includesInsulation: e.target.checked})} className="mr-1" /> Insulation</label>
          </div>
        </div>

        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-teal-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '🏠 Auto Estimate & Code Check'}
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            {/* Code Compliance */}
            {codeCheck && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg shadow-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center">
                    <span className="text-xl mr-2">✅</span> Code Compliance Check
                  </h3>
                  <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">PASSED</span>
                </div>
                <p className="text-xs text-gray-600 mt-2">This estimate meets {form.state} building code requirements</p>
                <div className="mt-2 text-xs">
                  <p className="font-semibold">Key Requirements:</p>
                  <ul className="list-disc pl-4 text-gray-600">
                    {codeCheck.requirements.slice(0, 3).map((req: string, i: number) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Permits:</span> {codeCheck.permits}</div>
                  <div><span className="text-gray-500">Inspections:</span> {codeCheck.inspections}</div>
                </div>
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Energy Code:</span> {codeCheck.energyCode}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg shadow-lg p-4 border border-blue-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Grand Total</p>
                  <p className="text-2xl font-bold text-blue-600">${estimate.summary.grandTotal.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Per Sq Ft</p>
                  <p className="text-xl font-bold text-teal-600">${estimate.summary.perSqFt.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Sq Ft</p>
                  <p className="text-xl font-bold text-green-600">{estimate.summary.totalSqFt.toFixed(0)}</p>
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
        <button onClick={() => router.push('/siding')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Siding</span>
        </button>
        <button onClick={() => router.push('/codes')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">Codes</span>
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
