'use client'

import { useRouter } from 'next/navigation'

export default function QuantumPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 text-white pb-20">
      <header className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">⚛️ Quantum AI Calculator</h1>
          <span className="ml-2 bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">CONCEPT PREVIEW</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white text-gray-900 rounded-lg shadow p-4 mb-4">
          <p className="text-sm font-semibold">Not an estimating or measurement tool</p>
          <p className="text-sm mt-2">
            ROOF/OS does not currently have a validated quantum calculation engine. No lifespan,
            replacement date, savings, ROI, probability, or sustainability score is generated here.
          </p>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-lg p-4 border border-cyan-500">
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-2">⚛️</span>
            <div>
              <p className="font-semibold">Quantum Superposition Engine</p>
              <p className="text-xs text-cyan-300">Concept only — calculation is unavailable.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
            <div className="rounded bg-indigo-950/70 p-3">Roof lifespan: Unknown</div>
            <div className="rounded bg-indigo-950/70 p-3">Replacement timing: Unknown</div>
            <div className="rounded bg-indigo-950/70 p-3">Cost savings: Unknown</div>
            <div className="rounded bg-indigo-950/70 p-3">ROI: Unknown</div>
          </div>

          <button
            type="button"
            disabled
            className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            ⚛️ Calculation unavailable
          </button>

          <button
            onClick={() => router.push('/measure')}
            className="w-full mt-2 bg-indigo-700 text-white py-3 rounded-lg font-semibold"
          >
            📐 Open Measurement
          </button>
        </div>
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
