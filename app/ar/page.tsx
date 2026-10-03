'use client'

import { useRouter } from 'next/navigation'

export default function ARPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <header className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🛸 AR Roof Scanner</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">CONCEPT PREVIEW</span>
        </div>
      </header>

      <main className="p-4">
        <div className="relative bg-gradient-to-br from-gray-900 to-blue-900 rounded-lg shadow-2xl p-4 mb-4 border border-cyan-500">
          <div className="h-72 flex items-center justify-center">
            <div className="relative">
              <span className="text-8xl absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">🏠</span>
              <div className="absolute bottom-0 left-0 right-0 text-center text-xs text-cyan-300">
                Concept preview only — no AR scan or inspection findings are generated.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => router.push('/measure')}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-3 rounded-lg font-semibold"
          >
            📐 Open Measurement
          </button>
          <button
            type="button"
            disabled
            className="bg-purple-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50"
            title="AR capture is not implemented"
          >
            📸 Capture — unavailable
          </button>
          <button
            type="button"
            disabled
            className="bg-orange-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50"
            title="3D model generation is not implemented"
          >
            📊 3D Model — unavailable
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-cyan-500 flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/ar')} className="flex flex-col items-center text-cyan-500">
          <span className="text-xl">🛸</span>
          <span className="text-xs">AR</span>
        </button>
        <button onClick={() => router.push('/vr')} className="flex flex-col items-center text-gray-400">
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
