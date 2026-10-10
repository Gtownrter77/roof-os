'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function CodesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedState, setSelectedState] = useState('GA')
  const [selectedCategory, setSelectedCategory] = useState('Roofing')
  const [results, setResults] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [zipCode, setZipCode] = useState('')

  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ]

  const categories = [
    'Roofing', 'Siding', 'Windows', 'Doors', 'Structural', 
    'Electrical', 'Plumbing', 'HVAC', 'Fire Safety', 'Accessibility',
    'Energy Efficiency', 'Environmental', 'Zoning', 'Permits'
  ]

  // Reference snapshots only. ZIP lookups use the current review endpoint.
  const codeDatabase: Record<string, Record<string, any>> = {
    'GA': {
      'Roofing': {
        code: 'GA Building Code Chapter 15',
        requirements: [
          'Minimum roof pitch 3:12 for shingles',
          'Ice and water shield required in northern GA counties',
          'Class A fire rating required',
          'Wind resistance: 120 mph in coastal areas, 100 mph inland',
          'Underlayment: ASTM D226 Type I or II',
          'Fasteners: Corrosion-resistant, minimum 1.25" penetration'
        ],
        materials: ['Asphalt shingles', 'Metal', 'Tile', 'Slate'],
        permits: 'Required for roof replacement over 100 sq ft',
        inspections: 'Final inspection required',
        energyCode: 'IECC 2021 compliant',
        windZone: 'Zone 2',
        snowLoad: '10 psf',
        seismic: 'Low',
        lastUpdated: '2024'
      },
      'Siding': {
        code: 'GA Building Code Chapter 14',
        requirements: [
          'Minimum weather-resistant barrier: ASTM E2556',
          'Furring strips required for vinyl siding over masonry',
          'Vinyl siding must meet ASTM D3679',
          'Maximum nailing spacing: 16"',
          'Corner trim required at all corners'
        ],
        materials: ['Vinyl', 'HardiePlank', 'Wood', 'Brick Veneer'],
        permits: 'Required for siding replacement over 100 sq ft',
        inspections: 'Final inspection required',
        energyCode: 'Continuous insulation required',
        lastUpdated: '2024'
      },
      'Windows': {
        code: 'GA Building Code Chapter 24',
        requirements: [
          'Minimum egress: 5.7 sq ft opening',
          'Minimum width: 20" opening',
          'Minimum height: 24" opening',
          'Tempered glass required within 24" of doors',
          'Impact resistance required in coastal counties',
          'U-factor: ≤ 0.30'
        ],
        materials: ['Vinyl', 'Wood', 'Aluminum', 'Fiberglass'],
        permits: 'Required for window replacement',
        inspections: 'Final inspection required',
        energyCode: 'ENERGY STAR certified required',
        lastUpdated: '2024'
      }
    },
    'CA': {
      'Roofing': {
        code: 'California Building Code - Title 24',
        requirements: [
          'Class A fire rating required statewide',
          'Cool roof requirements: SRI ≥ 0.75 for low-slope',
          'Wind resistance: 110 mph minimum',
          'Earthquake bracing required',
          'California Title 24 energy compliance required',
          'Wildfire zone requirements: ignition-resistant materials'
        ],
        materials: ['Metal', 'Tile', 'Concrete', 'Slate'],
        permits: 'Required for all roof work',
        inspections: 'Multiple inspections required',
        energyCode: 'Title 24 Part 6',
        windZone: 'Zone 3',
        snowLoad: '0-30 psf',
        seismic: 'High',
        lastUpdated: '2024'
      }
    },
    'FL': {
      'Roofing': {
        code: 'Florida Building Code - 8th Edition',
        requirements: [
          'High-velocity hurricane zone requirements',
          'Wind resistance: 150-180 mph depending on zone',
          'Impact-resistant materials required in HVHZ',
          'Secondary water barrier required',
          'Enhanced fastening schedule required',
          'Florida Product Approval required'
        ],
        materials: ['Metal', 'Tile', 'Concrete'],
        permits: 'Required for all roof work',
        inspections: 'Wind mitigation inspection required',
        energyCode: 'IECC 2021 with FL amendments',
        windZone: 'Zone 4',
        snowLoad: '0 psf',
        seismic: 'Low',
        lastUpdated: '2024'
      }
    },
    'TX': {
      'Roofing': {
        code: 'Texas Building Code - 2021',
        requirements: [
          'Wind resistance: 120 mph (windstorm areas)',
          'Hail-resistant materials recommended',
          'Ice and water shield required in northern counties',
          'Class A fire rating preferred',
          'TDI windstorm requirements for coastal counties'
        ],
        materials: ['Asphalt', 'Metal', 'Tile', 'Built-up'],
        permits: 'Required in most municipalities',
        inspections: 'Final inspection required',
        energyCode: 'IECC 2021',
        windZone: 'Zone 3',
        snowLoad: '0-20 psf',
        seismic: 'Low',
        lastUpdated: '2024'
      }
    },
    'NY': {
      'Roofing': {
        code: 'New York State Building Code',
        requirements: [
          'Snow load: 30-60 psf depending on location',
          'Ice dam protection required',
          'Class A fire rating required in urban areas',
          'Wind resistance: 100-120 mph',
          'Energy Code: NYSERDA compliant'
        ],
        materials: ['Asphalt', 'Metal', 'Slate', 'Tile'],
        permits: 'Required for roof work over 100 sq ft',
        inspections: 'Final inspection required',
        energyCode: 'NY State Energy Code',
        windZone: 'Zone 2',
        snowLoad: '30-60 psf',
        seismic: 'Moderate',
        lastUpdated: '2024'
      }
    }
  }

  const searchCodes = async () => {
    if (!zipCode.trim()) {
      setResults({ error: 'Enter a ZIP code to perform a current locality lookup. Embedded snapshots are reference data only and are not used for production guidance.' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/building-codes?zip=${encodeURIComponent(zipCode)}&category=${encodeURIComponent(selectedCategory)}`)
      const result = await response.json()
      setResults(response.ok ? result : { error: result.error ?? 'ZIP lookup failed.' })
    } catch {
      setResults({ error: 'ZIP lookup failed. Check the network and try again.' })
    } finally {
      setLoading(false)
    }
  }

  const exportCodeReport = () => {
    if (!results) return

    const payload = {
      type: 'roof-os-building-code-reference',
      state: selectedState,
      category: selectedCategory,
      zip: zipCode.trim() || null,
      results,
      exportedAt: new Date().toISOString(),
      warning: 'Reference data only. Verify the current locally adopted code, amendments, permits, and inspection requirements with the governing authority before use.',
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = 'roof-os-building-code-reference-' + new Date().toISOString().slice(0, 10) + '.json'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const searchByQuery = () => {
    if (!searchQuery.trim()) return
    if (!zipCode.trim()) {
      setResults({ error: 'Enter a ZIP code before searching building-code references. Production code guidance must be resolved to a locality.' })
      return
    }
    setResults({ error: 'Use the ZIP lookup above to retrieve the current locality-specific code family. The embedded snapshots are not used for production guidance.' })
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">📋 Building Codes</h1>
          <span className="ml-2 bg-amber-400/100 text-white text-xs px-2 py-0.5 rounded-full">REFERENCE + ZIP</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-100">Building-code content on this page is a reference snapshot, not legal or permit authority. ZIP results should be verified against the current local adoption and amendments.</p>
        </div>
        {/* Search */}
        <div className="glass rounded-xl p-4 mb-4 border border-cyan-400/30">
          <h3 className="font-semibold text-sm mb-3">🔍 Search Codes</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all states..."
              className="flex-1 p-2 border rounded-lg text-sm"
              onKeyDown={(e) => e.key === 'Enter' && searchByQuery()}
            />
            <button
              onClick={searchByQuery}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Search
            </button>
          </div>
        </div>

        {/* State & Category Selector */}
        <div className="glass rounded-xl p-4 mb-4 border border-cyan-400/30">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-slate-400">ZIP code lookup</label>
              <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="Enter ZIP to resolve locality" className="w-full p-2 border rounded-lg text-sm" />
              <p className="text-xs text-slate-400 mt-1">ZIP lookup resolves the locality. Verify local amendments before use. Embedded snapshots are not used for production guidance.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {states.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          </div>
          <button
            onClick={searchCodes}
            disabled={loading}
            className="w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {loading ? '⏳ Loading...' : '📋 View Building Codes'}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4 animate-fadeIn">
            {results.error ? (
              <div className="bg-amber-400/10 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800">{results.error}</p>
              </div>
            ) : results.jurisdiction ? (
              <div className="space-y-3">
                <div className="glass rounded-xl p-4 border-l-4 border-indigo-500">
                  <p className="text-xs text-slate-400">Resolved jurisdiction</p>
                  <p className="font-bold">{results.jurisdiction.city}, {results.jurisdiction.state} {results.jurisdiction.zip}</p>
                  <p className="text-xs text-slate-400">Category: {results.jurisdiction.category}</p>
                  <p className="text-xs text-amber-700 mt-2">{results.warning}</p>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-4 border border-cyan-400/30">
                  <p className="text-xs text-slate-400">Code family</p>
                  <p className="font-bold">{results.code.code}</p>
                  <p className="text-xs text-slate-300">{results.code.edition}</p>
                  <ul className="text-sm text-slate-200 list-disc pl-5 mt-2">{results.code.requirements.map((requirement: string) => <li key={requirement}>{requirement}</li>)}</ul>
                </div>
                <div className="glass rounded-xl p-4 text-xs text-slate-400">Locality source: {results.provenance.localitySource}. Code source: <a className="text-cyan-300 underline" href={results.provenance.codeSource} target="_blank" rel="noreferrer">ICC adoption reference</a>. Retrieved {new Date(results.provenance.retrievedAt).toLocaleString()}.</div>
              </div>
            ) : results.searchResults ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Found {results.searchResults.length} results</p>
                {results.searchResults.map((item: any, i: number) => (
                  <div key={i} className="glass rounded-xl p-4 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{item.state} - {item.category}</p>
                        <p className="text-xs text-slate-400">{item.data.code}</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        Updated {item.data.lastUpdated}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-slate-400">Requirements:</p>
                      <ul className="text-xs text-slate-300 list-disc pl-4 mt-1">
                        {item.data.requirements?.slice(0, 3).map((req: string, j: number) => (
                          <li key={j}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Code Info */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-4 border border-cyan-400/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-400">Code Reference</p>
                      <p className="font-bold">{results.code}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Updated {results.lastUpdated}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Wind Zone</p>
                      <p className="font-bold text-sm">{results.windZone}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Snow Load</p>
                      <p className="font-bold text-sm">{results.snowLoad}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Seismic</p>
                      <p className="font-bold text-sm">{results.seismic}</p>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="glass rounded-xl p-4">
                  <h3 className="font-semibold text-sm mb-2">📋 Requirements</h3>
                  <ul className="space-y-1">
                    {results.requirements?.map((req: string, i: number) => (
                      <li key={i} className="text-sm flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Materials */}
                <div className="glass rounded-xl p-4">
                  <h3 className="font-semibold text-sm mb-2">🧱 Approved Materials</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.materials?.map((mat: string, i: number) => (
                      <span key={i} className="bg-cyan-400/10 text-cyan-200 text-xs px-3 py-1 rounded-full">
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Permits & Inspections */}
                <div className="glass rounded-xl p-4 border-l-4 border-yellow-500">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Permits</p>
                      <p className="text-sm font-medium">{results.permits}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Inspections</p>
                      <p className="text-sm font-medium">{results.inspections}</p>
                    </div>
                  </div>
                </div>

                {/* Energy Code */}
                <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-lg p-3">
                  <p className="text-xs text-green-800">
                    ⚡ Energy Code: {results.energyCode}
                  </p>
                </div>
              </div>
            )}

            {/* Export */}
            <button type="button" onClick={exportCodeReport} className="ops-btn-primary w-full py-3">
              📄 Export Reference
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/codes')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">📋</span>
          <span className="text-xs">Codes</span>
        </button>
        <button onClick={() => router.push('/siding')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Siding</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}