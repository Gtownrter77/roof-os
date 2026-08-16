'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PitchGaugePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pitch, setPitch] = useState<number | null>(null)
  const [angle, setAngle] = useState<number | null>(null)
  const [pitchType, setPitchType] = useState<string>('')
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [measurements, setMeasurements] = useState<any[]>([])
  const [calibration, setCalibration] = useState({ x: 0, y: 0 })

  const pitchClassifications = [
    { min: 0, max: 2, label: 'Flat/Low Slope', color: '#22c55e', icon: '📐' },
    { min: 2.1, max: 4, label: 'Low Slope', color: '#84cc16', icon: '📐' },
    { min: 4.1, max: 6, label: 'Standard Slope', color: '#eab308', icon: '📐' },
    { min: 6.1, max: 9, label: 'Steep Slope', color: '#f59e0b', icon: '📐' },
    { min: 9.1, max: 12, label: 'Very Steep', color: '#f97316', icon: '📐' },
    { min: 12.1, max: 999, label: 'Extreme Slope', color: '#ef4444', icon: '⚠️' },
  ]

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err) {
      alert('Unable to access camera. Please allow camera permissions.')
    }
  }

  const measurePitch = () => {
    if (!cameraActive) {
      alert('Please start the camera first')
      return
    }
    
    setIsMeasuring(true)
    
    // Simulate AI pitch measurement
    setTimeout(() => {
      const measuredPitch = Math.floor(Math.random() * 10) + 2
      const measuredAngle = Math.round(Math.atan(measuredPitch / 12) * (180 / Math.PI))
      
      setPitch(measuredPitch)
      setAngle(measuredAngle)
      
      const classification = pitchClassifications.find(
        p => measuredPitch >= p.min && measuredPitch <= p.max
      )
      setPitchType(classification?.label || 'Unknown')
      
      const now = new Date().toLocaleTimeString()
      setMeasurements([{
        pitch: measuredPitch,
        angle: measuredAngle,
        type: classification?.label,
        time: now,
        id: Date.now()
      }, ...measurements])
      
      setIsMeasuring(false)
    }, 1500)
  }

  const getPitchInfo = (pitch: number) => {
    const info = pitchClassifications.find(p => pitch >= p.min && pitch <= p.max)
    return info || { label: 'Unknown', color: '#6b7280', icon: '📐' }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📐 AR Pitch Gauge</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>

      <main className="p-4">
        {/* Camera View */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-4 border-2 border-blue-500">
          <video
            ref={videoRef}
            className="w-full h-64 object-cover"
            playsInline
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-64 pointer-events-none"
          />
          
          {/* AR Overlay - Pitch Lines */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 bottom-0 w-0.5 h-32 bg-green-500/50 -translate-x-1/2" />
              <div className="absolute left-1/2 bottom-0 w-16 h-0.5 bg-green-500/50 -translate-x-1/2" />
              <div className="absolute left-1/2 bottom-0 w-0.5 h-16 bg-yellow-500/50 -translate-x-1/2 -translate-y-16" />
              <div className="absolute left-1/2 bottom-0 w-8 h-0.5 bg-yellow-500/50 -translate-x-1/2 -translate-y-16" />
            </div>
          )}
          
          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <span className="text-4xl block mb-2">📐</span>
                <p className="text-white text-sm">Tap "Start Camera" to measure pitch</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={startCamera}
            disabled={cameraActive}
            className={`py-3 rounded-lg font-semibold ${
              cameraActive ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {cameraActive ? '📷 Camera Active' : '📷 Start Camera'}
          </button>
          <button
            onClick={measurePitch}
            disabled={!cameraActive || isMeasuring}
            className={`py-3 rounded-lg font-semibold ${
              isMeasuring || !cameraActive ? 'bg-gray-600 text-gray-400' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
            }`}
          >
            {isMeasuring ? '⏳ Measuring...' : '📐 Measure Pitch'}
          </button>
        </div>

        {/* Current Measurement */}
        {pitch !== null && (
          <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 rounded-lg p-4 mb-4 border border-blue-500 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Current Measurement</p>
                <p className="text-3xl font-bold text-white">{pitch}/12</p>
                <p className="text-sm text-blue-300">{angle}° angle</p>
              </div>
              <div className="text-center">
                <div className={`px-4 py-2 rounded-lg text-sm font-bold`}
                     style={{ backgroundColor: getPitchInfo(pitch).color + '30', color: getPitchInfo(pitch).color }}>
                  {getPitchInfo(pitch).icon} {getPitchInfo(pitch).label}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Measurement History */}
        {measurements.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="font-semibold text-sm mb-3 text-gray-300">📋 History</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {measurements.map((m) => (
                <div key={m.id} className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                  <div>
                    <span className="font-bold text-white">{m.pitch}/12</span>
                    <span className="text-xs text-gray-400 ml-2">{m.angle}°</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">{m.type}</span>
                    <span className="text-xs text-gray-500 ml-2">{m.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-4 bg-blue-900/30 border border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            📐 Point camera at roof edge to measure pitch. AR overlay shows slope lines.
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/pitch-gauge')} className="flex flex-col items-center text-blue-500">
          <span className="text-xl">📐</span>
          <span className="text-xs">Pitch</span>
        </button>
        <button onClick={() => router.push('/ai-train')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🎓</span>
          <span className="text-xs">Train</span>
        </button>
        <button onClick={() => router.push('/photo-verify')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📸</span>
          <span className="text-xs">Verify</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
