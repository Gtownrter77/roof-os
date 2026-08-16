'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ARPage() {
  const router = useRouter()
  const [arMode, setArMode] = useState('scan')
  const [detectedIssues, setDetectedIssues] = useState<any[]>([])
  const [scanning, setScanning] = useState(false)

  const arIssues = [
    { id: 1, type: '🌊', label: 'Water Damage', severity: 'High', confidence: '94%' },
    { id: 2, type: '🔨', label: 'Structural Weakness', severity: 'Critical', confidence: '89%' },
    { id: 3, type: '💨', label: 'Wind Damage', severity: 'Medium', confidence: '78%' },
    { id: 4, type: '🔥', label: 'Heat Signature', severity: 'Low', confidence: '82%' },
  ]

  const startARScan = () => {
    setScanning(true)
    setTimeout(() => {
      setDetectedIssues(arIssues.slice(0, Math.floor(Math.random() * 3) + 2))
      setScanning(false)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <header className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🛸 AR Roof Scanner</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>

      <main className="p-4">
        {/* AR Viewport */}
        <div className="relative bg-gradient-to-br from-gray-900 to-blue-900 rounded-lg shadow-2xl p-4 mb-4 border border-cyan-500">
          <div className="h-72 flex items-center justify-center">
            <div className="relative">
              <span className="text-8xl absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">🏠</span>
              {detectedIssues.map((issue, i) => (
                <div 
                  key={i}
                  className="absolute animate-pulse"
                  style={{
                    top: `${20 + Math.random() * 60}%`,
                    left: `${20 + Math.random() * 60}%`,
                  }}
                >
                  <span className="text-3xl">{issue.type}</span>
                  <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full -mt-1">
                    {issue.confidence}
                  </div>
                </div>
              ))}
              <div className="absolute bottom-0 left-0 right-0 text-center text-xs text-cyan-300">
                {scanning ? '🔍 Scanning with LiDAR...' : '👆 Tap to scan'}
              </div>
            </div>
          </div>
        </div>

        {/* AR Controls */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button 
            onClick={startARScan}
            disabled={scanning}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {scanning ? '⏳ Scanning' : '🔍 AR Scan'}
          </button>
          <button className="bg-purple-600 text-white p-3 rounded-lg font-semibold">
            📸 Capture
          </button>
          <button className="bg-orange-600 text-white p-3 rounded-lg font-semibold">
            📊 3D Model
          </button>
        </div>

        {/* Detected Issues */}
        {detectedIssues.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 border border-cyan-500 animate-fadeIn">
            <h3 className="font-semibold text-sm mb-3 text-cyan-300">🎯 AI Detected Issues</h3>
            {detectedIssues.map((issue) => (
              <div key={issue.id} className="flex justify-between items-center border-b border-gray-700 py-2 last:border-0">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">{issue.type}</span>
                  <div>
                    <p className="text-sm">{issue.label}</p>
                    <p className="text-xs text-gray-400">Confidence: {issue.confidence}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  issue.severity === 'Critical' ? 'bg-red-600' :
                  issue.severity === 'High' ? 'bg-orange-600' :
                  'bg-yellow-600'
                }`}>
                  {issue.severity}
                </span>
              </div>
            ))}
            <button className="w-full mt-3 bg-cyan-600 text-white py-2 rounded-lg text-sm">
              📄 Generate AR Report
            </button>
          </div>
        )}
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
