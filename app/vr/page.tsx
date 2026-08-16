'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VRPage() {
  const router = useRouter()
  const [vrMode, setVrMode] = useState('explore')
  const [view, setView] = useState('top')
  const [recording, setRecording] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white pb-20">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🥽 VR Roof Walkthrough</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">3D</span>
        </div>
      </header>

      <main className="p-4">
        {/* VR Viewport */}
        <div className="relative bg-gradient-to-br from-gray-900 to-purple-900 rounded-lg shadow-2xl p-4 mb-4 border border-purple-500">
          <div className="h-80 flex items-center justify-center">
            <div className="relative w-full h-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-8xl block mb-2">🏠</span>
                  <p className="text-purple-300 text-sm">VR Roof View</p>
                  <div className="flex justify-center space-x-4 mt-2">
                    <span className="text-xs bg-purple-600 px-2 py-1 rounded">360°</span>
                    <span className="text-xs bg-pink-600 px-2 py-1 rounded">3D</span>
                  </div>
                </div>
              </div>
              {/* VR overlays */}
              <div className="absolute top-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                📍 View: {view === 'top' ? 'Top-Down' : 'Ground-Level'}
              </div>
              <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                🎮 Drag to look around
              </div>
            </div>
          </div>
        </div>

        {/* VR Controls */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button className="bg-purple-600 text-white p-3 rounded-lg font-semibold">🔄 Rotate</button>
          <button className="bg-pink-600 text-white p-3 rounded-lg font-semibold">📏 Measure</button>
          <button className="bg-indigo-600 text-white p-3 rounded-lg font-semibold">📍 Pin</button>
          <button 
            onClick={() => setRecording(!recording)}
            className={`${recording ? 'bg-red-600' : 'bg-green-600'} text-white p-3 rounded-lg font-semibold`}
          >
            {recording ? '⏹️ Stop' : '🔴 Record'}
          </button>
        </div>

        {/* VR Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-purple-900/50 rounded-lg p-3 text-center border border-purple-500">
            <p className="text-xs text-purple-300">Area</p>
            <p className="font-bold">1,245 sq ft</p>
          </div>
          <div className="bg-purple-900/50 rounded-lg p-3 text-center border border-purple-500">
            <p className="text-xs text-purple-300">Roof Pitch</p>
            <p className="font-bold">6/12</p>
          </div>
          <div className="bg-purple-900/50 rounded-lg p-3 text-center border border-purple-500">
            <p className="text-xs text-purple-300">Material</p>
            <p className="font-bold">Asphalt</p>
          </div>
        </div>

        {/* Export Options */}
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-lg font-semibold">
            📸 Export 3D Model
          </button>
          <button className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-3 rounded-lg font-semibold">
            📊 Share VR Tour
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
