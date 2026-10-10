'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DronePage() {
  const router = useRouter()
  const [droneStatus, setDroneStatus] = useState('Integration not connected')
  const [isFlying, setIsFlying] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [captureNotice, setCaptureNotice] = useState('')

  const startDroneScan = () => {
    setScanResults(null)
    setScanning(false)
    setDroneStatus('Integration not connected')
    setCaptureNotice('No live drone telemetry or imagery source is connected. Simulated scan results are disabled.')
  }

  const [scanResults, setScanResults] = useState<{
    roofArea: string
    damageZones: number
    hotspots: string[]
    estimatedDamage: string
    generatedAt: string
  } | null>(null)

  const handleTakeoff = () => {
    setIsFlying(false)
    setDroneStatus('Integration not connected')
    setCaptureNotice('Takeoff control is unavailable until a real drone integration is connected.')
  }

  const handleReturnHome = () => {
    setDroneStatus('Integration not connected')
    setCaptureNotice('Return-to-home control is unavailable until a real drone integration is connected.')
  }

  const recordAerialCapture = async () => {
    setCaptureNotice('No real aerial asset is available to record. Upload or acquire a real drone asset before creating a capture record.')
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => router.push('/')} className="mr-3 text-xl text-cyan-300" aria-label="Go to dashboard">←</button>
          <h1 className="text-xl font-bold">🚁 Drone Intelligence</h1>
          <span className="ml-2 bg-amber-400/100 text-white text-xs px-2 py-0.5 rounded-full">PILOT / SIMULATED</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-cyan-400/30 rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">🚁</span>
                <span className="font-semibold">Drone integration</span>
              </div>
              <p className="text-sm text-amber-700">Status: {droneStatus}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-white/50 text-white px-2 py-1 rounded">⚪ Not connected</span>
              <span className="text-xs bg-white/50 text-white px-2 py-1 rounded">📶 RTK unknown</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="text-center">
              <p className="text-xs text-slate-400">Battery</p>
              <p className="font-bold text-slate-300">Unknown</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Signal</p>
              <p className="font-bold text-slate-300">Unknown</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Altitude</p>
              <p className="font-bold text-slate-300">Unknown</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Frames</p>
              <p className="font-bold text-slate-300">Unknown</p>
            </div>
          </div>
        </div>

        {captureNotice && (
          <div className="bg-cyan-400/10 border border-cyan-400/30 text-blue-900 p-3 rounded-lg mb-4 text-sm" role="status">
            {captureNotice}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <button type="button" onClick={handleTakeoff} className="bg-white/50 text-white p-3 rounded-lg font-semibold">
            🛫 Takeoff unavailable
          </button>
          <button type="button" onClick={handleReturnHome} className="bg-white/50 text-white p-3 rounded-lg font-semibold">
            📍 Return Home unavailable
          </button>
          <button
            type="button"
            onClick={startDroneScan}
            disabled={scanning}
            className="bg-white/50 text-white p-3 rounded-lg font-semibold disabled:opacity-60"
          >
            🔍 Scan unavailable
          </button>
        </div>

        <div className="bg-black rounded-lg shadow p-2 mb-4">
          <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl block mb-2">🛸</span>
              <p className="text-white text-sm">Aerial feed not connected</p>
              <p className="text-slate-400 text-xs">No live camera or telemetry source is configured.</p>
              <div className="flex justify-center space-x-2 mt-2">
                <span className="text-xs text-amber-300">● SIMULATED / NOT LIVE</span>
                <span className="text-xs text-white">ALT Unknown</span>
              </div>
            </div>
          </div>
        </div>

        {scanResults && (
          <div className="glass rounded-xl p-4 mb-4 border border-amber-300">
            <h3 className="font-semibold text-sm mb-3">Simulated scan result</h3>
            <p className="text-sm text-amber-800">
              This result is intentionally unavailable until a real drone data source is connected.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void recordAerialCapture()}
          className="w-full bg-white/50 text-white text-sm px-4 py-3 rounded font-semibold"
        >
          Record aerial capture unavailable
        </button>
      </main>
    </div>
  )
}
