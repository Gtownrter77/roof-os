'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DronePage() {
  const router = useRouter()
  const [droneStatus, setDroneStatus] = useState('Ready')
  const [flightData, setFlightData] = useState({
    altitude: 0,
    battery: 100,
    signal: 'Strong',
    gps: 'Locked',
    images: 0,
    area: 0
  })
  const [isFlying, setIsFlying] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<any>(null)

  const startDroneScan = () => {
    setScanning(true)
    setDroneStatus('Scanning...')
    
    setTimeout(() => {
      setScanResults({
        roofArea: '1,245 sq ft',
        damageZones: 3,
        hotspots: ['South-west corner', 'Chimney area', 'Gutter line'],
        thermalReadings: 'Normal',
        structuralIssues: 'Minor flashing concern',
        estimatedDamage: '$4,200 - $5,800',
        highResImages: 24,
        thermalImages: 12,
        generatedAt: new Date().toLocaleString()
      })
      setScanning(false)
      setDroneStatus('Complete')
    }, 5000)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🚁 Drone Intelligence</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>

      <main className="p-4">
        {/* Drone Status */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg shadow-lg p-4 mb-4">
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
              <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">📶 5G</span>
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
              <p className="text-xs text-gray-500">GPS</p>
              <p className="font-bold text-green-600">{flightData.gps}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Images</p>
              <p className="font-bold text-purple-600">{flightData.images}</p>
            </div>
          </div>
        </div>

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
          <button className="bg-blue-600 text-white p-3 rounded-lg font-semibold">
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
        <div className="bg-black rounded-lg shadow-lg p-2 mb-4">
          <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl block mb-2">🛸</span>
              <p className="text-white text-sm">Live Drone Feed</p>
              <p className="text-gray-400 text-xs">1080p • 60fps • HDR</p>
              <div className="flex justify-center space-x-2 mt-2">
                <span className="text-xs text-green-400">● REC</span>
                <span className="text-xs text-white">15:23:47</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scan Results */}
        {scanResults && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border-2 border-purple-500 animate-fadeIn">
            <h3 className="font-semibold text-sm mb-3 flex justify-between">
              <span>📊 AI Analysis Results</span>
              <span className="text-xs text-gray-400">{scanResults.generatedAt}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-2 rounded">
                <p className="text-xs text-gray-500">Roof Area</p>
                <p className="font-bold">{scanResults.roofArea}</p>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <p className="text-xs text-gray-500">Damage Zones</p>
                <p className="font-bold text-red-600">{scanResults.damageZones}</p>
              </div>
              <div className="bg-yellow-50 p-2 rounded">
                <p className="text-xs text-gray-500">Hotspots</p>
                <p className="text-xs font-bold">{scanResults.hotspots.join(', ')}</p>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <p className="text-xs text-gray-500">Est. Damage</p>
                <p className="font-bold text-green-600">{scanResults.estimatedDamage}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                📸 {scanResults.highResImages} Images • {scanResults.thermalImages} Thermal
              </span>
              <button className="bg-purple-600 text-white text-xs px-3 py-1 rounded">
                📄 Generate Report
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/drone')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🚁</span>
          <span className="text-xs">Drone</span>
        </button>
        <button onClick={() => router.push('/supplement')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">Supplement</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
