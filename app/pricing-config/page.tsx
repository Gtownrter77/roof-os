'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [taxRates, setTaxRates] = useState({ state: 0, county: 0, city: 0, specialDistrict: 0 })
  const [taxSource, setTaxSource] = useState('Owner-entered jurisdiction rates')
  const [selectedState, setSelectedState] = useState('GA')
  const [laborRates, setLaborRates] = useState({
    roofing: { rate: 65, unit: 'sq', description: 'Roofing installation per square' },
    siding: { rate: 55, unit: 'sq', description: 'Siding installation per square' },
    windows: { rate: 75, unit: 'each', description: 'Window installation per unit' },
    doors: { rate: 85, unit: 'each', description: 'Door installation per unit' },
    gutters: { rate: 45, unit: 'ft', description: 'Gutter installation per linear foot' },
    decking: { rate: 60, unit: 'sq', description: 'Deck installation per square' },
    drywall: { rate: 40, unit: 'sq', description: 'Drywall installation per square' },
    painting: { rate: 35, unit: 'sq', description: 'Painting per square' },
    electrical: { rate: 95, unit: 'hr', description: 'Electrical work per hour' },
    plumbing: { rate: 90, unit: 'hr', description: 'Plumbing work per hour' },
    hvac: { rate: 100, unit: 'hr', description: 'HVAC work per hour' },
    demo: { rate: 50, unit: 'hr', description: 'Demolition work per hour' },
    cleanup: { rate: 35, unit: 'hr', description: 'Cleanup per hour' },
    inspection: { rate: 75, unit: 'hr', description: 'Inspection per hour' },
    consulting: { rate: 120, unit: 'hr', description: 'Consulting per hour' },
  })

  const [materialMarkup, setMaterialMarkup] = useState(25)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [dailyPrices, setDailyPrices] = useState<any>(null)
  const [selectedJobType, setSelectedJobType] = useState('roofing')
  const [customRate, setCustomRate] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [materialQuery, setMaterialQuery] = useState('')
  const [materials, setMaterials] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/pricing/labor-rates').then(async response => {
      const payload = await response.json()
      if (response.ok && payload.rates) setLaborRates(prev => Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, { ...value, rate: Number(payload.rates[key] ?? value.rate) }])) as typeof prev)
      if (response.ok && payload.taxRates) setTaxRates({ state: Number(payload.taxRates.state ?? 0), county: Number(payload.taxRates.county ?? 0), city: Number(payload.taxRates.city ?? 0), specialDistrict: Number(payload.taxRates.specialDistrict ?? 0) })
      if (response.ok && typeof payload.taxSource === 'string' && payload.taxSource) setTaxSource(payload.taxSource)
      if (response.ok && payload.priceBook?.effective_at) setLastUpdate(new Date(payload.priceBook.effective_at))
      if (payload.warning) setSaveMessage(payload.warning)
    }).catch(() => setSaveMessage('Could not load saved labor rates.'))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => fetch(`/api/materials?q=${encodeURIComponent(materialQuery)}`).then(async response => {
      const payload = await response.json()
      if (response.ok) setMaterials(payload.materials ?? [])
    }).catch(() => setMaterials([])), 250)
    return () => window.clearTimeout(timer)
  }, [materialQuery])

  const stateSalesTax: Record<string, number> = {
    'AL': 4.0, 'AK': 0, 'AZ': 5.6, 'AR': 6.5, 'CA': 7.25, 'CO': 2.9, 'CT': 6.35,
    'DE': 0, 'FL': 6.0, 'GA': 4.0, 'HI': 4.0, 'ID': 6.0, 'IL': 6.25, 'IN': 7.0,
    'IA': 6.0, 'KS': 6.5, 'KY': 6.0, 'LA': 4.45, 'ME': 5.5, 'MD': 6.0, 'MA': 6.25,
    'MI': 6.0, 'MN': 6.875, 'MS': 7.0, 'MO': 4.225, 'MT': 0, 'NE': 5.5, 'NV': 6.85,
    'NH': 0, 'NJ': 6.625, 'NM': 5.125, 'NY': 4.0, 'NC': 4.75, 'ND': 5.0, 'OH': 5.75,
    'OK': 4.5, 'OR': 0, 'PA': 6.0, 'RI': 7.0, 'SC': 6.0, 'SD': 4.5, 'TN': 7.0,
    'TX': 6.25, 'UT': 4.85, 'VT': 6.0, 'VA': 5.3, 'WA': 6.5, 'WV': 6.0, 'WI': 5.0,
    'WY': 4.0
  }

  const generateDailyPrices = () => {
    setLoading(false)
    setDailyPrices(null)
  }

  const updateLaborRate = (jobType: string, rate: string) => {
    const numRate = parseFloat(rate)
    if (!isNaN(numRate) && numRate > 0) {
      setLaborRates(prev => ({
        ...prev,
        [jobType]: { ...prev[jobType as keyof typeof prev], rate: numRate }
      }))
    }
  }

  const getJobTypeLabel = (key: string) => {
    const labels: Record<string, string> = {
      roofing: 'Roofing',
      siding: 'Siding',
      windows: 'Windows',
      doors: 'Doors',
      gutters: 'Gutters',
      decking: 'Decking',
      drywall: 'Drywall',
      painting: 'Painting',
      electrical: 'Electrical',
      plumbing: 'Plumbing',
      hvac: 'HVAC',
      demo: 'Demolition',
      cleanup: 'Cleanup',
      inspection: 'Inspection',
      consulting: 'Consulting'
    }
    return labels[key] || key
  }

  const getJobTypeIcon = (key: string) => {
    const icons: Record<string, string> = {
      roofing: '🏠', siding: '🏠', windows: '🪟', doors: '🚪',
      gutters: '🌧️', decking: '🪵', drywall: '📋', painting: '🎨',
      electrical: '⚡', plumbing: '🚰', hvac: '❄️', demo: '🔨',
      cleanup: '🧹', inspection: '🔍', consulting: '💡'
    }
    return icons[key] || '🔧'
  }

  const saveConfiguration = async () => {
    setSaveMessage('Saving owner-managed labor rates and local tax…')
    const response = await fetch('/api/pricing/labor-rates', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rates: Object.fromEntries(Object.entries(laborRates).map(([key, value]) => [key, value.rate])), market: selectedState, taxRates, taxSource }) })
    const payload = await response.json()
    if (response.ok) setLastUpdate(new Date())
    setSaveMessage(response.ok ? `Saved labor rates and ${payload.localTaxRate}% combined jurisdiction tax as draft price book ${payload.priceBookId}. Review and activate before use.` : (payload.error ?? 'Could not save pricing configuration.'))
  }

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? '📈' : '📉'
  }

  const getTrendColor = (change: string) => {
    return parseFloat(change) > 0 ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💰 Pricing Configuration</h1>
          <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">PROTOTYPE</span>
        </div>
      </header>

      <main className="p-4">
        {/* Last Update */}
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg shadow-lg p-3 mb-4 border border-blue-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Last Price Update</p>
              <p className="font-bold text-sm">{lastUpdate.toLocaleString()}</p>
            </div>
            <button
              onClick={generateDailyPrices}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? '⏳ Loading...' : '🔄 Connect a price source'}
            </button>
          </div>
        </div>

        {/* Daily Material Prices */}
        {dailyPrices && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-green-200">
            <h3 className="font-semibold text-sm mb-3 flex items-center">
              <span className="text-xl mr-2">📊</span> Daily Material Prices
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(dailyPrices).map(([key, value]: [string, any]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium capitalize">{key}</span>
                    <span className={`text-xs ${getTrendColor(value.change)}`}>
                      {getTrendIcon(value.trend)} {value.change}%
                    </span>
                  </div>
                  <p className="text-lg font-bold">${value.current}</p>
                  <p className="text-xs text-gray-400">Base: ${value.base}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400 text-center">
              Imported source values only — every value must carry a source, market, and effective date.
            </div>
          </div>
        )}

        <div className="bg-amber-50 rounded-lg shadow-sm p-4 mb-4 border border-amber-200">
          <h3 className="font-semibold text-sm mb-2">Current claims pricing is not connected</h3>
          <p className="text-xs text-amber-900 leading-5">
            No fabricated prices are shown here. Connect an authorized CapOut/ESX import, licensed provider, verified supplier feed, or owner-managed price book before using this screen for an insurance estimate. Imported values must retain source, market, effective date, and review status.
          </p>
        </div>

        {/* Local Tax */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-purple-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🧾</span> Local Tax Configuration
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">State reference</label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value)
                  setTaxRates(prev => ({ ...prev, state: stateSalesTax[e.target.value] || 0 }))
                  setTaxSource(`${e.target.value} state reference — verify county and municipal rates before approval`)
                }}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {Object.keys(stateSalesTax).sort().map(state => (
                  <option key={state} value={state}>
                    {state} ({stateSalesTax[state]}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">State tax rate</label>
              <input type="number" value={taxRates.state} onChange={e => setTaxRates({ ...taxRates, state: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded-lg text-sm" step="0.0001" min="0" max="100" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {([['county','County'],['city','City / municipality'],['specialDistrict','Special district']] as const).map(([key, label]) => <label key={key} className="text-xs text-gray-500">{label}<input type="number" value={taxRates[key]} onChange={e => setTaxRates({ ...taxRates, [key]: parseFloat(e.target.value) || 0 })} className="w-full mt-1 p-2 border rounded-lg text-sm" step="0.0001" min="0" max="100" /></label>)}
          </div>
          <label className="block mt-3 text-xs text-gray-500">Tax jurisdiction / source
            <input
              value={taxSource}
              onChange={(e) => setTaxSource(e.target.value)}
              maxLength={200}
              className="mt-1 w-full p-2 border rounded-lg text-sm"
              placeholder="Example: Cobb County, GA — owner-verified combined rate"
            />
          </label>
          <div className="mt-2 p-2 bg-purple-50 rounded">
            <p className="text-xs text-purple-800">
              Current combined tax: <strong>{Object.values(taxRates).reduce((sum, rate) => sum + rate, 0).toFixed(4)}%</strong> • Saved as separate jurisdiction rates
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-green-200">
          <h3 className="font-semibold text-sm mb-2">Expanded material catalog</h3>
          <p className="text-xs text-gray-500 mb-3">Search GAF, VELUX, fasteners, ventilation, decking, gutters, disposal, and other catalog metadata. Prices remain source-verified reference data.</p>
          <input value={materialQuery} onChange={e => setMaterialQuery(e.target.value)} className="w-full p-2 border rounded-lg text-sm" placeholder="Search materials, brands, colors, or sizes" />
          <div className="mt-3 max-h-64 overflow-y-auto space-y-2">{materials.slice(0, 30).map(material => <div key={material.id} className="border rounded p-2"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{[material.brand, material.product_name, material.variant].filter(Boolean).join(' — ')}</span><span className="text-xs text-gray-500">{material.unit}</span></div><p className="text-xs text-gray-500">{material.category} / {material.subcategory ?? 'general'}{material.color_options?.length ? ` • ${material.color_options.join(', ')}` : ''}</p></div>)}</div>
        </div>

        {/* Labor Rates */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-orange-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">👷</span> Labor Rate Configuration
          </h3>
          <p className="text-xs text-gray-400 mb-3">Set custom labor rates for each job type</p>
          
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {Object.entries(laborRates).map(([key, value]: [string, any]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                <div className="flex items-center gap-1">
                  <span>{getJobTypeIcon(key)}</span>
                  <span className="text-xs font-medium">{getJobTypeLabel(key)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">$</span>
                  <input
                    type="number"
                    value={value.rate}
                    onChange={(e) => updateLaborRate(key, e.target.value)}
                    className="w-20 p-1 border rounded text-sm"
                    step="0.5"
                  />
                  <span className="text-xs text-gray-400">/ {value.unit}</span>
                </div>
                <p className="text-[10px] text-gray-400 truncate">{value.description}</p>
              </div>
            ))}
          </div>
          {saveMessage && <p className="mt-3 text-xs text-blue-800 bg-blue-50 rounded p-2">{saveMessage}</p>}
        </div>

        {/* Price History */}
        {priceHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-gray-200">
            <h3 className="font-semibold text-sm mb-3 flex items-center">
              <span className="text-xl mr-2">📜</span> Price History
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {priceHistory.slice(0, 7).map((entry, i) => (
                <div key={i} className="flex justify-between items-center border-b py-1 text-sm">
                  <span className="text-gray-600">{entry.date}</span>
                  <div className="flex gap-3">
                    <span className="text-xs">🪙 ${entry.prices?.shingles?.current || '-'}</span>
                    <span className="text-xs">🪵 ${entry.prices?.lumber?.current || '-'}</span>
                    <span className="text-xs">🪟 ${entry.prices?.windows?.current || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Markup & Summary */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">📊</span> Markup Configuration
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Material Markup %</label>
              <input
                type="number"
                value={materialMarkup}
                onChange={(e) => setMaterialMarkup(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border rounded-lg text-sm"
                step="0.5"
              />
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500">Current Margin</p>
              <p className="text-xl font-bold text-green-600">{materialMarkup}%</p>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
            📄 Export Pricing Guide
          </button>
          <button onClick={saveConfiguration} className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
            💾 Save Configuration
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/pricing-config')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Estimate</span>
        </button>
        <button onClick={() => router.push('/insurance-intel')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">Intel</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
