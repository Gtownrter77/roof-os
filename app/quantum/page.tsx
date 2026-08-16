'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QuantumPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [variables, setVariables] = useState({
    age: 15,
    area: 2000,
    location: 'Atlanta',
    material: 'Asphalt',
    weatherExposure: 'High',
    maintenance: 'Moderate'
  })

  const runQuantumCalc = () => {
    setLoading(true)
    setTimeout(() => {
      setResult({
        lifespan: '22.7 years',
        optimalReplacement: '2034',
        costSaving: '$14,200',
        roi: '187%',
        sustainabilityScore: 92,
        quantumProbability: '99.97%',
        parallelRealities: [
          { scenario: 'Best Case', outcome: 'Roof lasts 35 years', probability: '18%' },
          { scenario: 'Expected', outcome: 'Roof lasts 22 years', probability: '62%' },
          { scenario: 'Worst Case', outcome: 'Roof lasts 15 years', probability: '20%' }
        ]
      })
      setLoading(false)
    }, 4000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 text-white pb-20">
      <header className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">⚛️ Quantum AI Calculator</h1>
          <span className="ml-2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">QUANTUM</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-lg p-4 mb-4 border border-cyan-500">
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-2">⚛️</span>
            <div>
              <p className="font-semibold">Quantum Superposition Engine</p>
              <p className="text-xs text-cyan-300">Calculating all possible outcomes simultaneously</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-cyan-300">Roof Age (years)</label>
              <input
                type="range"
                min="1"
                max="50"
                value={variables.age}
                onChange={(e) => setVariables({...variables, age: Number(e.target.value)})}
                className="w-full"
              />
              <span className="text-sm font-bold text-cyan-300">{variables.age} years</span>
            </div>
            <div>
              <label className="text-xs text-cyan-300">Area (sq ft)</label>
              <input
                type="range"
                min="500"
                max="5000"
                value={variables.area}
                onChange={(e) => setVariables({...variables, area: Number(e.target.value)})}
                className="w-full"
              />
              <span className="text-sm font-bold text-cyan-300">{variables.area} sq ft</span>
            </div>
            <div>
              <label className="text-xs text-cyan-300">Material</label>
              <select 
                value={variables.material}
                onChange={(e) => setVariables({...variables, material: e.target.value})}
                className="w-full p-1 bg-indigo-900 border border-cyan-500 rounded text-white text-sm"
              >
                <option>Asphalt</option>
                <option>Metal</option>
                <option>Tile</option>
                <option>Slate</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-cyan-300">Weather Exposure</label>
              <select 
                value={variables.weatherExposure}
                onChange={(e) => setVariables({...variables, weatherExposure: e.target.value})}
                className="w-full p-1 bg-indigo-900 border border-cyan-500 rounded text-white text-sm"
              >
                <option>Low</option>
                <option>Moderate</option>
                <option>High</option>
                <option>Extreme</option>
              </select>
            </div>
          </div>

          <button 
            onClick={runQuantumCalc}
            disabled={loading}
            className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '⚛️ Calculating Quantum States...' : '⚛️ Run Quantum Calculation'}
          </button>
        </div>

        {result && (
          <div className="space-y-3 animate-fadeIn">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg p-4 border border-cyan-500">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-indigo-800/50 rounded">
                  <p className="text-xs text-cyan-300">Quantum Lifespan</p>
                  <p className="text-xl font-bold text-cyan-400">{result.lifespan}</p>
                </div>
                <div className="text-center p-2 bg-indigo-800/50 rounded">
                  <p className="text-xs text-cyan-300">Optimal Replacement</p>
                  <p className="text-xl font-bold text-purple-400">{result.optimalReplacement}</p>
                </div>
                <div className="text-center p-2 bg-indigo-800/50 rounded">
                  <p className="text-xs text-cyan-300">Cost Saving</p>
                  <p className="text-xl font-bold text-green-400">{result.costSaving}</p>
                </div>
                <div className="text-center p-2 bg-indigo-800/50 rounded">
                  <p className="text-xs text-cyan-300">Quantum ROI</p>
                  <p className="text-xl font-bold text-yellow-400">{result.roi}</p>
                </div>
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs text-cyan-300">Sustainability Score</p>
                <div className="w-full bg-indigo-800 rounded-full h-2.5">
                  <div className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2.5 rounded-full" style={{width: `${result.sustainabilityScore}%`}}></div>
                </div>
                <p className="text-sm mt-1">{result.sustainabilityScore}/100</p>
                <p className="text-xs text-purple-400">Quantum Probability: {result.quantumProbability}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg p-4 border border-purple-500">
              <h3 className="font-semibold text-sm mb-3 text-purple-300">🌌 Parallel Reality Outcomes</h3>
              {result.parallelRealities.map((reality: any, i: number) => (
                <div key={i} className="flex justify-between items-center border-b border-indigo-700 py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{reality.scenario}</p>
                    <p className="text-xs text-gray-400">{reality.outcome}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-purple-800">{reality.probability}</span>
                </div>
              ))}
            </div>

            <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold">
              📄 Generate Quantum Report
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-purple-500 flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/ar')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🛸</span>
          <span className="text-xs">AR</span>
        </button>
        <button onClick={() => router.push('/vr')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🥽</span>
          <span className="text-xs">VR</span>
        </button>
        <button onClick={() => router.push('/quantum')} className="flex flex-col items-center text-cyan-500">
          <span className="text-xl">⚛️</span>
          <span className="text-xs">Quantum</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
