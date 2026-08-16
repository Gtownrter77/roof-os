'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GeneticPage() {
  const router = useRouter()
  const [generations, setGenerations] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [evolving, setEvolving] = useState(false)
  const [solutions, setSolutions] = useState<any[]>([])

  const evolve = () => {
    setEvolving(true)
    let gen = 0
    const interval = setInterval(() => {
      gen++
      setGenerations(gen)
      const score = Math.floor(Math.random() * 30) + 70
      setBestScore(score)
      
      setSolutions(prev => {
        const newSolution = {
          generation: gen,
          score: score,
          materials: ['Asphalt', 'Metal', 'Tile', 'Slate'][Math.floor(Math.random() * 4)],
          cost: `$${Math.floor(Math.random() * 5000) + 5000}`,
          lifespan: `${Math.floor(Math.random() * 20) + 15} years`
        }
        return [newSolution, ...prev].slice(0, 6)
      })

      if (gen >= 50 || score > 98) {
        clearInterval(interval)
        setEvolving(false)
      }
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-teal-950 text-white pb-20">
      <header className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🧬 Genetic AI Optimizer</h1>
          <span className="ml-2 bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">EVOLVING</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-br from-green-900/50 to-teal-900/50 rounded-lg p-4 mb-4 border border-teal-500">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-green-800/50 rounded">
              <p className="text-xs text-teal-300">Generations</p>
              <p className="text-2xl font-bold text-teal-400">{generations}</p>
            </div>
            <div className="text-center p-2 bg-green-800/50 rounded">
              <p className="text-xs text-teal-300">Best Score</p>
              <p className="text-2xl font-bold text-yellow-400">{bestScore}%</p>
            </div>
            <div className="text-center p-2 bg-green-800/50 rounded">
              <p className="text-xs text-teal-300">Status</p>
              <p className="text-sm font-bold text-green-400">{evolving ? '🔄 Evolving' : '✅ Complete'}</p>
            </div>
          </div>

          <button 
            onClick={evolve}
            disabled={evolving}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {evolving ? '🧬 Evolving Generation...' : '🧬 Start Genetic Evolution'}
          </button>
        </div>

        {solutions.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-teal-300">🧬 Evolution Solutions</h3>
            {solutions.map((sol, i) => (
              <div key={i} className="bg-green-900/30 rounded-lg p-3 border border-teal-700">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Gen {sol.generation}</p>
                    <p className="text-xs text-gray-400">Material: {sol.materials}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-400">{sol.score}%</p>
                    <p className="text-xs text-gray-400">{sol.cost} • {sol.lifespan}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-teal-500 flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/genetic')} className="flex flex-col items-center text-teal-500">
          <span className="text-xl">🧬</span>
          <span className="text-xs">Genetic</span>
        </button>
        <button onClick={() => router.push('/quantum')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚛️</span>
          <span className="text-xs">Quantum</span>
        </button>
        <button onClick={() => router.push('/ar')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🛸</span>
          <span className="text-xs">AR</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
