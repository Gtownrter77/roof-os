'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UpsellPage() {
  const router = useRouter()
  const [selectedProject, setSelectedProject] = useState('')
  const [upsells, setUpsells] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const projectTypes = [
    'Roof Replacement',
    'Siding Installation',
    'Window Replacement',
    'Deck Construction',
    'Gutter Replacement',
    'Full Exterior Renovation',
    'Storm Damage Repair',
    'Commercial Roofing'
  ]

  const getUpsells = () => {
    if (!selectedProject) {
      alert('Please select a project type')
      return
    }
    
    setUpsells(null)
    setLoading(false)
    return
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'High': 'bg-red-100 text-red-800 border-red-400',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-400',
      'Low': 'bg-green-100 text-green-800 border-green-400'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const totalUpsellPotential = () => {
    if (!upsells || !upsells.primary) return 0
    let total = 0
    upsells.primary.forEach((item: any) => {
      const cost = item.costIncrease ? parseFloat(item.costIncrease.replace(/[^0-9.-]+/g, '')) : 0
      total += cost
    })
    upsells.crossSell?.forEach((item: any) => {
      const cost = item.cost ? parseFloat(item.cost.replace(/[^0-9.-]+/g, '')) : 0
      total += cost
    })
    return total
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💰 AI Upsell Engine</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">PRO</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">Price is Unknown. This screen does not write a bid.</p>
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-amber-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🎯</span> Select Project Type
          </h3>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full p-3 border rounded-lg text-sm mb-3"
          >
            <option value="">Select a project...</option>
            {projectTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <button
            onClick={getUpsells}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '⏳ Analyzing...' : '🔍 Find Upsell Opportunities'}
          </button>
        </div>

        {upsells && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-lg p-4 border-2 border-amber-500">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Total Upsell Potential</p>
                  <p className="text-2xl font-bold text-amber-600">${totalUpsellPotential().toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Estimated Profit</p>
                  <p className="text-xl font-bold text-green-600">+Unknown</p>
                </div>
              </div>
            </div>

            {upsells.primary && upsells.primary.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-amber-500">
                <h3 className="font-semibold text-sm mb-3 flex items-center">
                  <span className="text-xl mr-2">⬆️</span> Premium Upgrades
                </h3>
                {upsells.primary.map((item: any, i: number) => (
                  <div key={i} className={`border-2 rounded-lg p-3 mb-3 last:mb-0 ${getPriorityColor(item.priority)}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-600">{item.upgrade}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.priority === 'High' ? 'bg-red-500 text-white' :
                        item.priority === 'Medium' ? 'bg-yellow-500 text-white' :
                        'bg-green-500 text-white'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <span className="text-gray-500">Added Cost:</span>
                        <span className="font-bold block">{item.costIncrease}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">ROI:</span>
                        <span className="font-bold block text-green-600">{item.roi}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Margin:</span>
                        <span className="font-bold block text-blue-600">{item.profitMargin}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">✅ {item.customerBenefit}</p>
                  </div>
                ))}
              </div>
            )}

            {upsells.crossSell && upsells.crossSell.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
                <h3 className="font-semibold text-sm mb-3 flex items-center">
                  <span className="text-xl mr-2">🔄</span> Cross-Sell Opportunities
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {upsells.crossSell.map((item: any, i: number) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs font-bold text-blue-600">{item.cost}</span>
                        <span className="text-xs text-green-600">{item.profit} margin</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.priority === 'High' ? 'bg-red-100 text-red-800' :
                        item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.priority} priority
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button className="bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Upsell Proposal
              </button>
              <button className="bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold">
                💰 Add to Estimate
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
        <button onClick={() => router.push('/upsell')} className="flex flex-col items-center text-amber-600">
          <span className="text-xl">💰</span>
          <span className="text-xs">Upsell</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/insurance')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
