'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SupplementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [supplements, setSupplements] = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState('')
  const [supplementData, setSupplementData] = useState({
    jobAddress: '',
    originalEstimate: 0,
    currentProgress: 0,
    uncoveredDamage: '',
    additionalMaterials: '',
    photos: [] as string[],
  })

  // Pre-defined supplement scenarios
  const supplementScenarios = [
    {
      id: 1,
      name: 'Roof Deck Damage',
      description: 'Rotting wood found under shingles',
      additionalCost: 2500,
      materials: ['Plywood sheets', 'Nails', 'Tar paper'],
      labor: '4 hours extra',
      urgency: 'High'
    },
    {
      id: 2,
      name: 'Flashing Failure',
      description: 'Chimney flashing completely deteriorated',
      additionalCost: 1800,
      materials: ['Step flashing', 'Counter flashing', 'Caulk'],
      labor: '3 hours extra',
      urgency: 'Medium'
    },
    {
      id: 3,
      name: 'Gutter System Replacement',
      description: 'Gutters are damaged and need full replacement',
      additionalCost: 3200,
      materials: ['Gutters', 'Downspouts', 'Hangers'],
      labor: '5 hours extra',
      urgency: 'Medium'
    },
    {
      id: 4,
      name: 'Ventilation Issues',
      description: 'Inadequate ventilation causing moisture damage',
      additionalCost: 1500,
      materials: ['Ridge vents', 'Soffit vents', 'Insulation'],
      labor: '3 hours extra',
      urgency: 'Low'
    },
    {
      id: 5,
      name: 'Structural Damage',
      description: 'Truss damage found during inspection',
      additionalCost: 4500,
      materials: ['Lumber', 'Steel plates', 'Screws'],
      labor: '8 hours extra',
      urgency: 'Critical'
    },
    {
      id: 6,
      name: 'Ice Dam Prevention',
      description: 'Ice dam prevention system needed',
      additionalCost: 1200,
      materials: ['Ice & water shield', 'Heat cables', 'Insulation'],
      labor: '2 hours extra',
      urgency: 'Low'
    }
  ]

  const [detectedSupplements, setDetectedSupplements] = useState<any[]>([])

  const runSupplementAnalysis = () => {
    setLoading(true)
    
    // Simulate AI detection
    setTimeout(() => {
      const detected = supplementScenarios
        .filter(() => Math.random() > 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1)
      
      setDetectedSupplements(detected)
      setLoading(false)
    }, 2000)
  }

  const approveSupplement = (id: number) => {
    const supplement = detectedSupplements.find(s => s.id === id)
    if (supplement) {
      setSupplements([...supplements, { ...supplement, approved: true, date: new Date().toLocaleDateString() }])
      setDetectedSupplements(detectedSupplements.filter(s => s.id !== id))
    }
  }

  const rejectSupplement = (id: number) => {
    setDetectedSupplements(detectedSupplements.filter(s => s.id !== id))
  }

  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      'Critical': 'bg-red-100 text-red-800',
      'High': 'bg-orange-100 text-orange-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-green-100 text-green-800'
    }
    return colors[urgency] || 'bg-gray-100 text-gray-800'
  }

  const totalSupplementCost = supplements.reduce((sum, s) => sum + s.additionalCost, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📋 Supplement Engine</h1>
          <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
            AI Active
          </span>
        </div>
      </header>

      <main className="p-4">
        {/* Job Selection */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">🔍 Select Job</h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Enter job address"
              className="w-full p-2 border rounded-lg text-sm"
              value={supplementData.jobAddress}
              onChange={(e) => setSupplementData({...supplementData, jobAddress: e.target.value})}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Original Estimate"
                className="p-2 border rounded-lg text-sm"
                value={supplementData.originalEstimate || ''}
                onChange={(e) => setSupplementData({...supplementData, originalEstimate: Number(e.target.value)})}
              />
              <input
                type="number"
                placeholder="Current Progress %"
                className="p-2 border rounded-lg text-sm"
                value={supplementData.currentProgress || ''}
                onChange={(e) => setSupplementData({...supplementData, currentProgress: Number(e.target.value)})}
              />
            </div>
            <button
              onClick={runSupplementAnalysis}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? '⏳ Analyzing...' : '🤖 Run Supplement Analysis'}
            </button>
          </div>
        </div>

        {/* Detected Supplements */}
        {detectedSupplements.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 border-2 border-yellow-400">
            <h3 className="font-semibold text-sm mb-3 flex justify-between">
              <span>🔍 Detected Supplements ({detectedSupplements.length})</span>
              <span className="text-yellow-600 text-xs">Needs Review</span>
            </h3>
            {detectedSupplements.map((supp) => (
              <div key={supp.id} className="border rounded-lg p-3 mb-3 last:mb-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{supp.name}</p>
                    <p className="text-xs text-gray-500">{supp.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${getUrgencyColor(supp.urgency)}`}>
                    {supp.urgency}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Materials:</span>
                    <span className="ml-1">{supp.materials.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Labor:</span>
                    <span className="ml-1">{supp.labor}</span>
                  </div>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-blue-600 font-bold">+${supp.additionalCost.toFixed(2)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveSupplement(supp.id)}
                      className="bg-green-600 text-white text-xs px-3 py-1 rounded"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => rejectSupplement(supp.id)}
                      className="bg-red-600 text-white text-xs px-3 py-1 rounded"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approved Supplements */}
        {supplements.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 border-2 border-green-500">
            <h3 className="font-semibold text-sm mb-3 flex justify-between">
              <span>✅ Approved Supplements ({supplements.length})</span>
              <span className="text-green-600">Total: +${totalSupplementCost.toFixed(2)}</span>
            </h3>
            {supplements.map((supp, index) => (
              <div key={index} className="flex justify-between items-center border-b py-2 last:border-0">
                <div>
                  <p className="font-medium text-sm">{supp.name}</p>
                  <p className="text-xs text-gray-400">{supp.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-600 font-bold">+${supp.additionalCost.toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${getUrgencyColor(supp.urgency)}`}>
                    {supp.urgency}
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-3 pt-2 border-t flex justify-between font-bold">
              <span>Total Supplements</span>
              <span className="text-blue-600">+${totalSupplementCost.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* AI Suggestions */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">💡 AI Suggestions</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Consider checking for water damage in attic</li>
            <li>• Inspect all flashing points for potential leaks</li>
            <li>• Review gutter system for proper drainage</li>
            <li>• Check ventilation adequacy</li>
          </ul>
        </div>

        {/* Generate Supplement Report */}
        {supplements.length > 0 && (
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">
            📄 Generate Supplement Report
          </button>
        )}

        {detectedSupplements.length === 0 && supplements.length === 0 && !loading && (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <span className="text-4xl block mb-2">📋</span>
            <p className="text-gray-500">No supplements detected</p>
            <p className="text-xs text-gray-400">Run analysis to detect supplement opportunities</p>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/supplement')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📋</span>
          <span className="text-xs">Supplement</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/estimate')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">Estimate</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
