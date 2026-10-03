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

  const calculateEstimate = async () => {
    if (!Number.isFinite(measurements.linearFeet) || measurements.linearFeet <= 0) {
      setSaveMessage('Enter measured linear feet before saving. No default quantity is assumed.')
      return
    }
    await saveMeasurement()
  }

  const formatCurrency = (num: number) => {
    return 'Unknown'
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
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full ">REVIEW-GATED</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">Price is Unknown. This screen does not write a bid.</p>
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
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
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
