'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UpsellPage() {
  const router = useRouter()
  const [selectedProject, setSelectedProject] = useState('')
  const [upsells, setUpsells] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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

  const upsellDatabase: Record<string, any> = {
    'Roof Replacement': {
      primary: [
        { 
          name: 'Premium Shingles', 
          upgrade: 'Architectural shingles vs 3-tab',
          customerBenefit: '40-year warranty, better curb appeal',
          priority: 'High'
        },
        { 
          name: 'Ice & Water Shield', 
          upgrade: 'Full coverage vs minimal',
          customerBenefit: 'Prevents ice dam damage, longer roof life',
          priority: 'High'
        }
      ],
      crossSell: [
        { 
          name: 'Gutter Guards', 
          description: 'Prevent clogs and damage',
          priority: 'High'
        },
        { 
          name: 'Skylight Installation', 
          description: 'Add natural light to attic',
          priority: 'Medium'
        }
      ]
    },
    'Siding Installation': {
      primary: [
        { 
          name: 'Premium Siding Material', 
          upgrade: 'HardiePlank vs Vinyl',
          customerBenefit: '100-year lifespan, fire resistant, no rot',
          priority: 'High'
        }
      ],
      crossSell: [
        { 
          name: 'Window Replacement', 
          description: 'Match new siding with new windows',
          priority: 'High'
        }
      ]
    },
    'Window Replacement': {
      primary: [
        { 
          name: 'Energy-Efficient Glass', 
          upgrade: 'Low-E argon vs standard',
          customerBenefit: '30% energy savings, UV protection',
          priority: 'High'
        }
      ],
      crossSell: [
        { 
          name: 'Door Replacement', 
          description: 'Complete entry upgrade',
          priority: 'High'
        }
      ]
    },
    'Deck Construction': {
      primary: [
        { 
          name: 'Premium Decking', 
          upgrade: 'Composite vs wood',
          customerBenefit: 'No maintenance, 25-year warranty, no splinters',
          priority: 'High'
        }
      ],
      crossSell: [
        { 
          name: 'Pergola', 
          description: 'Covered deck area',
          priority: 'High'
        }
      ]
    },
    'Gutter Replacement': {
      primary: [
        { 
          name: 'Copper Gutters', 
          upgrade: 'Copper vs aluminum',
          customerBenefit: '100-year lifespan, premium appearance',
          priority: 'High'
        }
      ],
      crossSell: [
        { 
          name: 'Downspout Extensions', 
          description: 'Better water management',
          priority: 'Medium'
        }
      ]
    }
  }

  const getUpsells = () => {
    if (!selectedProject) {
      setMessage('Select a project type first.')
      return
    }

    setMessage('')
    setLoading(true)
    const data = upsellDatabase[selectedProject as keyof typeof upsellDatabase]
    setUpsells(data ?? { primary: [], crossSell: [] })
    setLoading(false)
  }

  const copyProposal = async () => {
    if (!upsells) return
    const lines = [
      'ROOF/OS upsell suggestions',
      'Project: ' + selectedProject,
      ...(upsells.primary ?? []).map((item: any) => 'Upgrade: ' + item.name + ' — ' + item.upgrade),
      ...(upsells.crossSell ?? []).map((item: any) => 'Cross-sell: ' + item.name + ' — ' + item.description),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setMessage('Upsell suggestions copied. Pricing must come from the active owner-managed price book.')
    } catch {
      setMessage('Copy is not available in this browser.')
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'High': 'bg-red-100 text-red-800 border-red-400',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-400',
      'Low': 'bg-green-100 text-green-800 border-green-400'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💰 Upsell Suggestions</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">REFERENCE</span>
        </div>
      </header>

      <main className="p-4">
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
              <p className="font-semibold text-sm">Reference suggestions only</p>
              <p className="text-xs text-gray-600 mt-1">No ROI, margin, or selling price is calculated here. Use the active owner-managed price book before quoting a customer.</p>
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
              <button type="button" onClick={() => void copyProposal()} className="bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold">
                📋 Copy Proposal
              </button>
              <button type="button" onClick={() => router.push('/pricing')} className="bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold">
                💰 Open Estimate
              </button>
            </div>
            {message && <p className="mt-3 text-sm text-blue-800 bg-blue-50 rounded p-3" role="status">{message}</p>}
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
