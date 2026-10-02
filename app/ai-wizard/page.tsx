'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AIWizardPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  const askQuestion = () => {
    setLoading(false)
    return
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🧙 AI Construction Wizard</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">REFERENCE AI</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">No model was called. Result is Unknown.</p>
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
                {response.confidence !== null && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">{response.confidence}% confidence</span>
                )}
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
