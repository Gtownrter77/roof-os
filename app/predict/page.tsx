'use client'

import { useRouter } from 'next/navigation'

export default function PredictPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🧠 Predictive AI</h1>
          <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">CONCEPT PREVIEW</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-purple-200">
          <h3 className="font-semibold">AI Future Damage Predictor</h3>
          <p className="text-sm text-gray-600 mt-2">
            No validated predictive model is connected to this screen. ROOF/OS will not invent
            roof lifespan, risk scores, storm timing, damage locations, recommendations, or cost projections.
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
            <div className="bg-white rounded p-3">Roof life: Unknown</div>
            <div className="bg-white rounded p-3">Risk score: Unknown</div>
            <div className="bg-white rounded p-3">Storm timing: Unknown</div>
            <div className="bg-white rounded p-3">Cost projection: Unknown</div>
          </div>

          <button
            type="button"
            disabled
            className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            🔮 Prediction unavailable
          </button>

          <button
            onClick={() => router.push('/measure')}
            className="w-full mt-2 bg-purple-700 text-white py-3 rounded-lg font-semibold"
          >
            📐 Open Measurement
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/predict')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🧠</span>
          <span className="text-xs">Predict</span>
        </button>
        <button onClick={() => router.push('/drone')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🚁</span>
          <span className="text-xs">Drone</span>
        </button>
        <button onClick={() => router.push('/supplement')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">Supplement</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
