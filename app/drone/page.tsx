'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function DronePage() {
  const router = useRouter()
  const supabase = createClient()
  const [droneStatus, setDroneStatus] = useState('Ready')
  const [flightData, setFlightData] = useState({
    altitude: 45,
    battery: 92,
    signal: 'Strong',
    gps: 'Locked (18 sats)',
    images: 24,
    area: 2850
  })
  const [isFlying, setIsFlying] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [savingCapture, setSavingCapture] = useState(false)
  const [captureNotice, setCaptureNotice] = useState('')
  const [scanResults, setScanResults] = useState<{
    roofArea: string
    damageZones: number
    hotspots: string[]
    thermalReadings: string
    structuralIssues: string
    estimatedDamage: string
    highResImages: number
    thermalImages: number
    generatedAt: string
    captureId?: string
  } | null>(null)

  const startDroneScan = () => {
    setScanning(true)
    setDroneStatus('Scanning mission active...')
    setCaptureNotice('')

    setTimeout(() => {
      setScanResults({
        roofArea: '2,850 sq ft (28.5 SQ)',
        damageZones: 3,
        hotspots: ['South-west valley rake', 'Chimney step flashing', 'North-east gutter run'],
        thermalReadings: 'Normal insulation, moisture candidate at dormer valley',
        structuralIssues: 'Hail impact bruising on south facet shingles',
        estimatedDamage: '$5,200 - $7,400',
        highResImages: 24,
        thermalImages: 12,
        generatedAt: new Date().toLocaleTimeString()
      })
      setScanning(false)
      setDroneStatus('Mission Complete')
    }, 1200)
  }

  const recordAerialCapture = async () => {
    setSavingCapture(true)
    setCaptureNotice('')
    try {
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId) {
        setCaptureNotice('No active workspace configured.')
        setSavingCapture(false)
        return
      }

      const response = await fetch('/api/measurements/drone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          assetUrl: 'https://storage.roof-os.local/inspections/aerial-mission-latest.jpg',
          sourceType: 'drone_photo',
          altitudeM: flightData.altitude,
          cameraMake: 'DJI',
          cameraModel: 'Mavic 3 Pro Cine',
          notes: 'Automated roof perimeter grid scan with 80% overlap'
        })
      })

      const data = await response.json()
      if (response.ok) {
        setCaptureNotice(`Aerial capture recorded in workspace ledger (ID: ${data.capture?.id?.slice(0, 8)}). ${data.warning || ''}`)
        if (scanResults) {
          setScanResults({ ...scanResults, captureId: data.capture?.id })
        }
      } else {
        setCaptureNotice(data.error || 'Could not record aerial capture.')
      }
    } catch {
      setCaptureNotice('Network error while recording capture.')
    } finally {
      setSavingCapture(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.push('/')} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🚁 Drone Intelligence</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>
      <main className="p-4">
        {/* Drone Status */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">🚁</span>
                <span className="font-semibold">DJI Mavic 3 Pro</span>
              </div>
              <p className={`text-sm ${droneStatus === 'Ready' ? 'text-green-600' : 'text-blue-600'}`}>
                Status: {droneStatus}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">🟢 Connected</span>
              <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">📶 RTK Fixed</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Battery</p>
              <p className="font-bold text-green-600">{flightData.battery}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Signal</p>
              <p className="font-bold text-blue-600">{flightData.signal}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Altitude</p>
              <p className="font-bold text-purple-600">{flightData.altitude}m</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Frames</p>
              <p className="font-bold text-purple-600">{flightData.images}</p>
            </div>
          </div>
        </div>

        {captureNotice && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg mb-4 text-sm" role="status">
            {captureNotice}
          </div>
        )}

        {/* Flight Controls */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => setIsFlying(!isFlying)}
            className={`p-3 rounded-lg font-semibold ${
              isFlying ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
            }`}
          >
            {isFlying ? '🛑 Land' : '🛫 Takeoff'}
          </button>
          <button
            onClick={() => {
              setDroneStatus('Returning to Home point (RTH)...')
              setTimeout(() => setDroneStatus('Ready'), 2000)
            }}
            className="bg-blue-600 text-white p-3 rounded-lg font-semibold"
          >
            📍 Return Home
          </button>
          <button
            onClick={startDroneScan}
            disabled={scanning}
            className={`p-3 rounded-lg font-semibold ${
              scanning ? 'bg-gray-400 text-gray-600' : 'bg-purple-600 text-white'
            }`}
          >
            {scanning ? '⏳ Scanning...' : '🔍 Start Scan'}
          </button>
        </div>

        {/* Live View */}
        <div className="bg-black rounded-lg shadow p-2 mb-4">
          <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl block mb-2">🛸</span>
              <p className="text-white text-sm">4K Aerial Gimbal Feed</p>
              <p className="text-gray-400 text-xs">FOV 84° • 24mm • f/2.8 • 1/500s</p>
              <div className="flex justify-center space-x-2 mt-2">
                <span className="text-xs text-green-400">● RTK TELEMETRY ACTIVE</span>
                <span className="text-xs text-white">ALT 45.2m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scan Results */}
        {scanResults && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 border border-purple-300">
            <h3 className="font-semibold text-sm mb-3 flex justify-between">
              <span>📊 AI Photogrammetry Scan Summary</span>
              <span className="text-xs text-gray-400">{scanResults.generatedAt}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-2 rounded">
                <p className="text-xs text-gray-500">Estimated Area</p>
                <p className="font-bold">{scanResults.roofArea}</p>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <p className="text-xs text-gray-500">Damage Targets</p>
                <p className="font-bold text-red-600">{scanResults.damageZones}</p>
              </div>
              <div className="bg-yellow-50 p-2 rounded">
                <p className="text-xs text-gray-500">Feature Hotspots</p>
                <p className="text-xs font-bold">{scanResults.hotspots.join(', ')}</p>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <p className="text-xs text-gray-500">Est. Impact Scope</p>
                <p className="font-bold text-green-600">{scanResults.estimatedDamage}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-between items-center">
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                📸 {scanResults.highResImages} Nadir Images • {scanResults.thermalImages} Oblique
              </span>
              <button
                onClick={recordAerialCapture}
                disabled={savingCapture}
                className="w-full sm:w-auto bg-purple-600 text-white text-xs px-4 py-2 rounded font-semibold disabled:opacity-50"
              >
                {savingCapture ? 'Ingesting...' : 'Record Aerial Capture to DB'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
