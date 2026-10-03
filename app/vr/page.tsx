'use client'

import { useRouter } from 'next/navigation'

export default function VRPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white pb-20">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🥽 VR Roof Walkthrough</h1>
          <span className="ml-2 bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">CONCEPT PREVIEW</span>
        </div>
      </header>

      <main className="p-4">
        <div className="relative bg-gradient-to-br from-gray-900 to-purple-900 rounded-lg shadow-2xl p-4 mb-4 border border-purple-500">
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <span className="text-8xl block mb-2">🏠</span>
              <p className="text-purple-300 text-sm">VR walkthrough is not implemented.</p>
              <p className="text-xs text-gray-400 mt-2">
                No 3D roof model, measurements, recordings, pins, exports, or inspection findings are generated here.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button type="button" disabled className="bg-purple-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50">
            🔄 Rotate — unavailable
          </button>
          <button type="button" disabled className="bg-pink-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50">
            📏 Measure — unavailable
          </button>
          <button type="button" disabled className="bg-indigo-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50">
            📍 Pin — unavailable
          </button>
          <button type="button" disabled className="bg-green-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50">
            🔴 Record — unavailable
          </button>
        </div>

        <div className="bg-purple-900/50 rounded-lg p-4 border border-purple-500">
          <p className="text-sm font-semibold">Use the implemented measurement workflow</p>
          <p className="text-xs text-gray-300 mt-1">
            Measurements must come from the persisted ROOF/OS measurement workflow, not this concept screen.
          </p>
          <button
            onClick={() => router.push('/measure')}
            className="w-full mt-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-lg font-semibold"
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
        <button onClick={() => router.push('/vr')} className="flex flex-col items-center text-purple-500">
          <span className="text-xl">🥽</span>
          <span className="text-xs">VR</span>
        </button>
        <button onClick={() => router.push('/quantum')} className="flex flex-col items-center text-gray-400">
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
