'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CodesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedState, setSelectedState] = useState('')
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

  const searchCodes = async () => {
    setLoading(true)
    if (zipCode.trim()) {
      try {
        const response = await fetch(`/api/building-codes?zip=${encodeURIComponent(zipCode)}&category=${encodeURIComponent(selectedCategory)}`)
        const result = await response.json()
        setResults(response.ok ? result : { error: result.error ?? 'ZIP lookup failed.' })
      } catch {
        setResults({ error: 'ZIP lookup failed. Check the network and try again.' })
      } finally {
        setLoading(false)
      }
      return
    }
    setResults({ error: 'Unknown. Enter a ZIP. A local table is not a permit decision.' })
    setLoading(false)
  }

  const searchByQuery = () => {
    setResults({ error: 'Unknown. Text search of the local table is not a code lookup.' })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📋 Building Codes</h1>
          <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">ZIP + REVIEW</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">A local table is not a permit decision. Unknown unless the ZIP lookup returns a record.</p>
        {/* Search */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
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
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-gray-500">ZIP code lookup</label>
              <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="Enter ZIP to resolve locality" className="w-full p-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">ZIP lookup identifies the locality only. Code text is Unknown.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {states.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Category</label>
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
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800">{results.error}</p>
              </div>
            ) : results.jurisdiction ? (
              <div className="space-y-3">
                <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-indigo-500">
                  <p className="text-xs text-gray-500">Resolved jurisdiction</p>
                  <p className="font-bold">{results.jurisdiction.city}, {results.jurisdiction.state} {results.jurisdiction.zip}</p>
                  <p className="text-xs text-gray-500">Category: {results.jurisdiction.category}</p>
                  <p className="text-xs text-amber-700 mt-2">{results.warning}</p>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-4 border border-blue-200">
                  <p className="text-xs text-gray-500">Code family</p>
                  <p className="font-bold">{results.code.code}</p>
                  <p className="text-xs text-gray-600">{results.code.edition}</p>
                  <ul className="text-sm text-gray-700 list-disc pl-5 mt-2">{results.code.requirements.map((requirement: string) => <li key={requirement}>{requirement}</li>)}</ul>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-xs text-gray-500">Locality source: {results.provenance.localitySource}. Code source: <a className="text-blue-600 underline" href={results.provenance.codeSource} target="_blank" rel="noreferrer">ICC adoption reference</a>. Retrieved {new Date(results.provenance.retrievedAt).toLocaleString()}.</div>
              </div>
            ) : results.searchResults ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Found {results.searchResults.length} results</p>
                {results.searchResults.map((item: any, i: number) => (
                  <div key={i} className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{item.state} - {item.category}</p>
                        <p className="text-xs text-gray-500">{item.data.code}</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        Updated {item.data.lastUpdated}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-500">Requirements:</p>
                      <ul className="text-xs text-gray-600 list-disc pl-4 mt-1">
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
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-4 border border-blue-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500">Code Reference</p>
                      <p className="font-bold">{results.code}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Updated {results.lastUpdated}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Wind Zone</p>
                      <p className="font-bold text-sm">{results.windZone}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Snow Load</p>
                      <p className="font-bold text-sm">{results.snowLoad}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Seismic</p>
                      <p className="font-bold text-sm">{results.seismic}</p>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-white rounded-lg shadow-lg p-4">
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
                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="font-semibold text-sm mb-2">🧱 Approved Materials</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.materials?.map((mat: string, i: number) => (
                      <span key={i} className="bg-blue-50 text-blue-800 text-xs px-3 py-1 rounded-full">
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Permits & Inspections */}
                <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-yellow-500">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Permits</p>
                      <p className="text-sm font-medium">{results.permits}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Inspections</p>
                      <p className="text-sm font-medium">{results.inspections}</p>
                    </div>
                  </div>
                </div>

                {/* Energy Code */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-800">
                    ⚡ Energy Code: {results.energyCode}
                  </p>
                </div>
              </div>
            )}

            {/* Export */}
            <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">
              📄 Export Code Report
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/codes')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📋</span>
          <span className="text-xs">Codes</span>
        </button>
        <button onClick={() => router.push('/siding')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Siding</span>
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
