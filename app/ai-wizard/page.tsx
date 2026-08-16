'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AIWizardPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  const constructionKnowledge: Record<string, any> = {
    'roof': {
      answer: 'Your roof should be inspected annually. Common issues include: missing shingles, leaks around flashing, and gutter blockages. Average roof replacement costs $8,000-$15,000 depending on materials and size.',
      code: 'Check local building codes for minimum pitch requirements (typically 3:12 for asphalt shingles).',
      materials: ['Asphalt', 'Metal', 'Tile', 'Slate'],
      lifespan: '15-50 years depending on material'
    },
    'siding': {
      answer: 'Siding protects your home from weather. Vinyl is most affordable, HardiePlank offers durability, and wood gives classic look. Average installation costs $6-$12 per square foot.',
      code: 'Weather-resistant barrier required behind all siding. Minimum lap spacing varies by material.',
      materials: ['Vinyl', 'HardiePlank', 'Wood', 'Fiber Cement'],
      lifespan: '20-50 years'
    },
    'windows': {
      answer: 'Energy-efficient windows save money. Look for ENERGY STAR certified, Low-E glass, and argon gas fill. Average cost: $600-$1,200 per window installed.',
      code: 'Egress requirements: minimum 5.7 sq ft opening for bedrooms. Tempered glass required near doors.',
      materials: ['Vinyl', 'Wood', 'Aluminum', 'Fiberglass'],
      lifespan: '20-30 years'
    },
    'deck': {
      answer: 'Deck construction requires proper footings, framing, and decking. Composite decking is low-maintenance but costs more upfront.',
      code: 'Guard rails required for decks over 30" high. Stair treads must be at least 10" deep.',
      materials: ['Composite', 'Wood', 'PVC', 'Aluminum'],
      lifespan: '15-30 years'
    },
    'gutters': {
      answer: 'Gutters should be cleaned twice yearly. Seamless gutters are preferred. Downspouts should direct water away from foundation.',
      code: 'Minimum pitch: 1/4 inch per 10 feet. Downspouts every 40 feet of gutter.',
      materials: ['Aluminum', 'Copper', 'Steel', 'Vinyl'],
      lifespan: '20-50 years'
    },
    'permit': {
      answer: 'Most exterior work requires permits. Costs vary by county. Always verify before starting work.',
      code: 'Permits typically required for: new roofs (over 100 sq ft), siding replacement, window replacement, decks over 30" high.',
      timeline: '1-4 weeks for permit approval'
    },
    'foundation': {
      answer: 'Foundation issues include cracks, settling, and water intrusion. Professional inspection recommended for major concerns.',
      code: 'Minimum footing depth: 12" below frost line. Proper drainage essential.',
      materials: ['Concrete', 'Poured', 'Block', 'Slab'],
      lifespan: '100+ years'
    },
    'structural': {
      answer: 'Structural integrity is crucial. Signs of issues include cracks, sagging floors, sticking doors, and water stains.',
      code: 'Load-bearing walls require proper engineering. Trusses must be designed for snow loads.',
      inspection: 'Professional engineer inspection recommended for structural concerns.'
    },
    'energy': {
      answer: 'Energy efficiency improves with proper insulation, windows, and HVAC. Average savings: 15-30% on utility bills.',
      code: 'Minimum insulation: R-38 in attics, R-13 in walls. Energy Star certification available.',
      savings: '$200-$500 annually'
    }
  }

  const askQuestion = () => {
    if (!query.trim()) return
    setLoading(true)
    
    setTimeout(() => {
      const lowerQuery = query.toLowerCase()
      let foundAnswer = null
      
      for (const [key, value] of Object.entries(constructionKnowledge)) {
        if (lowerQuery.includes(key)) {
          foundAnswer = {
            topic: key,
            ...value,
            confidence: Math.floor(Math.random() * 20) + 80
          }
          break
        }
      }
      
      if (!foundAnswer) {
        foundAnswer = {
          topic: 'general',
          answer: `I understand you're asking about "${query}". This is a complex construction topic. I recommend consulting with a licensed professional contractor or building inspector for specific guidance.`,
          code: 'Local building codes may apply. Check with your municipality.',
          confidence: 65
        }
      }
      
      setResponse(foundAnswer)
      setHistory([{ query, response: foundAnswer, time: new Date().toLocaleTimeString() }, ...history])
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🧙 AI Construction Wizard</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">GPT</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow-lg p-4 mb-4 border border-indigo-200">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🧙</span>
            <div>
              <h3 className="font-semibold">Ask Anything About Construction</h3>
              <p className="text-xs text-gray-500">AI-powered construction expert with building code knowledge</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
            placeholder="Ask about roofing, siding, permits, codes..."
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={askQuestion}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '⏳' : 'Ask'}
          </button>
        </div>

        {response && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-indigo-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-500">AI Response</p>
                  <p className="text-sm text-gray-700 mt-1">{response.answer}</p>
                </div>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                  {response.confidence}% confidence
                </span>
              </div>
              
              {response.code && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs font-semibold text-yellow-800">📋 Building Code:</p>
                  <p className="text-xs text-yellow-700">{response.code}</p>
                </div>
              )}
              
              {response.materials && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {response.materials.map((mat: string, i: number) => (
                    <span key={i} className="bg-indigo-50 text-indigo-800 text-xs px-2 py-1 rounded">
                      {mat}
                    </span>
                  ))}
                  {response.lifespan && (
                    <span className="bg-gray-50 text-gray-600 text-xs px-2 py-1 rounded">
                      Lifespan: {response.lifespan}
                    </span>
                  )}
                </div>
              )}
              
              <div className="mt-3 flex gap-2">
                <button className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">
                  📄 Save
                </button>
                <button className="bg-purple-600 text-white text-xs px-3 py-1 rounded">
                  📤 Share
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                ⚠️ This is AI-generated advice. Always verify with local building codes and licensed professionals.
              </p>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-sm mb-3">📜 History</h3>
            {history.map((item, i) => (
              <div key={i} className="border-b last:border-0 py-2">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">{item.query}</p>
                  <p className="text-xs text-gray-400">{item.time}</p>
                </div>
                <p className="text-xs text-gray-500">{item.response.answer.substring(0, 100)}...</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/ai-wizard')} className="flex flex-col items-center text-indigo-600">
          <span className="text-xl">🧙</span>
          <span className="text-xs">Wizard</span>
        </button>
        <button onClick={() => router.push('/photo-estimate')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📸</span>
          <span className="text-xs">Photo AI</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
