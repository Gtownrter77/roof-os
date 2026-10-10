'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function AIWizardPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  const constructionKnowledge: Record<string, any> = {
    'roof': {
      answer: 'Inspect the roof at least once a year. Common issues include missing shingles, leaks around flashing, and blocked gutters. Replacement cost stays Unknown until a human prices the job.',
      code: 'Check local building codes for minimum pitch requirements (typically 3:12 for asphalt shingles).',
      materials: ['Asphalt', 'Metal', 'Tile', 'Slate'],
      lifespan: '15-50 years depending on material'
    },
    'siding': {
      answer: 'Siding protects the house from weather. Vinyl, fiber cement, and wood are common. Installed price stays Unknown until a human prices the job.',
      code: 'Weather-resistant barrier required behind all siding. Minimum lap spacing varies by material.',
      materials: ['Vinyl', 'HardiePlank', 'Wood', 'Fiber Cement'],
      lifespan: '20-50 years'
    },
    'windows': {
      answer: 'Look for Low-E glass and argon fill when the spec calls for them. Installed price stays Unknown until a human prices the job.',
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
      answer: 'Most exterior work needs a permit. The fee stays Unknown until the county quote is in hand. Verify before starting work.',
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
      answer: 'Insulation, windows, and HVAC change energy use. Dollar savings stay Unknown until a bill comparison exists.',
      code: 'Attic and wall insulation targets depend on the local code. Confirm them before you specify a product.',
      savings: 'Unknown'
    }
  }

  const askQuestion = async () => {
    if (!query.trim()) return
    setLoading(true)
    const asked = query.trim()
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: asked, currentPath: '/ai-wizard' }),
      })
      const payload = await response.json()
      const reply = typeof payload.reply === 'string' ? payload.reply : ''
      const lowerQuery = asked.toLowerCase()
      let foundAnswer: { topic: string; answer: string; code?: string; confidence: null } | null = null
      if (reply) {
        foundAnswer = { topic: 'copilot', answer: reply, code: 'Local text assistant. It does not set a price.', confidence: null }
      }
      if (!foundAnswer) {
        for (const [key, value] of Object.entries(constructionKnowledge)) {
          if (lowerQuery.includes(key)) {
            foundAnswer = { topic: key, answer: value.answer, code: value.code, confidence: null }
            break
          }
        }
      }
      if (!foundAnswer) {
        foundAnswer = {
          topic: 'general',
          answer: `No local note matched "${asked}". Check the code book and a licensed inspector before you treat this as guidance.`,
          code: 'Local building codes may apply.',
          confidence: null,
        }
      }
      setResponse(foundAnswer)
      setHistory([{ query: asked, response: foundAnswer, time: new Date().toLocaleTimeString() }, ...history])
    } catch {
      setResponse({ topic: 'general', answer: 'The assistant could not be reached. The glossary is still on this page.', confidence: null })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">🧙 AI Construction Wizard</h1>
          <span className="ml-2 bg-emerald-400/100 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">REFERENCE AI</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow-lg p-4 mb-4 border border-indigo-200">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🧙</span>
            <div>
              <h3 className="font-semibold">Ask Anything About Construction</h3>
              <p className="text-xs text-slate-400">AI-powered construction expert with building code knowledge</p>
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
            <div className="glass rounded-xl p-4 border-2 border-indigo-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-400">AI Response</p>
                  <p className="text-sm text-slate-200 mt-1">{response.answer}</p>
                </div>
                {response.confidence !== null && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">{response.confidence}% confidence</span>
                )}
              </div>
              
              {response.code && (
                <div className="mt-3 p-3 bg-amber-400/10 border border-yellow-200 rounded">
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
                    <span className="bg-white/5 text-slate-300 text-xs px-2 py-1 rounded">
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

            <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-lg p-3">
              <p className="text-xs text-cyan-200">
                ⚠️ This is AI-generated advice. Always verify with local building codes and licensed professionals.
              </p>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-4 glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">📜 History</h3>
            {history.map((item, i) => (
              <div key={i} className="border-b last:border-0 py-2">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">{item.query}</p>
                  <p className="text-xs text-slate-400">{item.time}</p>
                </div>
                <p className="text-xs text-slate-400">{item.response.answer.substring(0, 100)}...</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/ai-wizard')} className="flex flex-col items-center text-indigo-600">
          <span className="text-xl">🧙</span>
          <span className="text-xs">Wizard</span>
        </button>
        <button onClick={() => router.push('/photo-estimate')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">📸</span>
          <span className="text-xs">Photo AI</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
