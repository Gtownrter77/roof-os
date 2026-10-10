'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function VRPage() {
  const router = useRouter()
  const [view, setView] = useState<'top' | 'ground'>('top')
  const [rotation, setRotation] = useState(0)
  const [recording, setRecording] = useState(false)
  const [observations, setObservations] = useState<string[]>([])
  const [fieldMeasurement, setFieldMeasurement] = useState('')
  const [message, setMessage] = useState('')

  const rotateView = () => {
    setRotation((current) => (current + 45) % 360)
    setMessage('Viewer rotated 45°.')
  }

  const addMeasurement = () => {
    const value = prompt('Enter a field measurement to record (for example, 24 ft ridge):')
    const trimmed = value?.trim()
    if (!trimmed) return
    setFieldMeasurement(trimmed)
    setMessage('Field measurement recorded for this session.')
  }

  const addPin = () => {
    setObservations((current) => [...current, 'Observation ' + (current.length + 1)])
    setMessage('Observation pin added.')
  }

  const toggleRecording = () => {
    setRecording((current) => !current)
    setMessage(recording ? 'Session recording stopped.' : 'Session recording started.')
  }

  const shareSession = () => {
    const summary = 'ROOF/OS walkthrough session\n'
      + 'View: ' + (view === 'top' ? 'Top-Down' : 'Ground-Level') + '\n'
      + 'Rotation: ' + rotation + '°\n'
      + 'Field measurement: ' + (fieldMeasurement || 'none') + '\n'
      + 'Observation pins: ' + observations.length

    if (!navigator.share) {
      setMessage('Sharing is not available in this browser.')
      return
    }

    void navigator.share({ title: 'ROOF/OS Walkthrough Session', text: summary })
      .then(() => setMessage('Walkthrough session shared.'))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setMessage('Could not share the walkthrough session.')
      })
  }

  const exportSession = () => {
    const payload = {
      type: 'roof-os-walkthrough-session',
      view,
      rotation,
      recording,
      fieldMeasurement: fieldMeasurement || null,
      observations,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = 'roof-os-walkthrough-' + new Date().toISOString().slice(0, 10) + '.json'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage('Walkthrough session exported.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white pb-20">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" type="button" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">🥽 Walkthrough Session</h1>
          <span className="ml-2 bg-amber-400/100 text-white text-xs px-2 py-0.5 rounded-full">VIEWER</span>
        </div>
      </header>

      <main className="p-4">
        <div className="relative bg-gradient-to-br from-gray-900 to-purple-900 rounded-lg shadow-2xl p-4 mb-4 border border-purple-500">
          <div className="h-80 flex items-center justify-center overflow-hidden">
            <div
              className="text-center transition-transform duration-300"
              style={{ transform: 'perspective(700px) rotateY(' + rotation + 'deg) scaleY(' + (view === 'top' ? 1 : 0.82) + ')' }}
            >
              <span className="text-8xl block mb-2" aria-hidden="true">🏠</span>
              <p className="text-purple-300 text-sm">No 3D roof model loaded</p>
              <div className="flex justify-center gap-2 mt-2">
                <span className="text-xs bg-purple-600 px-2 py-1 rounded">{rotation}°</span>
                <span className="text-xs bg-indigo-600 px-2 py-1 rounded">{view === 'top' ? 'Top-Down' : 'Ground-Level'}</span>
              </div>
            </div>
            <div className="absolute top-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">Session viewer only — no measurement authority</div>
            <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">Field measurements remain verified source data</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <button type="button" onClick={rotateView} className="bg-purple-600 text-white p-3 rounded-lg font-semibold">🔄 Rotate</button>
          <button
            type="button"
            onClick={addMeasurement}
            className="bg-pink-600 text-white p-3 rounded-lg font-semibold"
          >📏 Measure</button>
          <button type="button" onClick={addPin} className="bg-indigo-600 text-white p-3 rounded-lg font-semibold">📍 Pin</button>
          <button
            type="button"
            onClick={toggleRecording}
            className={(recording ? 'bg-red-600' : 'bg-green-600') + ' text-white p-3 rounded-lg font-semibold'}
          >
            {recording ? '⏹️ Stop' : '🔴 Record'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button type="button" onClick={() => setView('top')} className={(view === 'top' ? 'bg-white text-purple-900' : 'bg-purple-800') + ' p-3 rounded-lg font-semibold'}>Top-Down</button>
          <button type="button" onClick={() => setView('ground')} className={(view === 'ground' ? 'bg-white text-purple-900' : 'bg-purple-800') + ' p-3 rounded-lg font-semibold'}>Ground-Level</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-purple-900/50 rounded-lg p-3 text-center border border-purple-500">
            <p className="text-xs text-purple-300">Rotation</p><p className="font-bold">{rotation}°</p>
          </div>
          <div className="bg-purple-900/50 rounded-lg p-3 text-center border border-purple-500">
            <p className="text-xs text-purple-300">Pins</p><p className="font-bold">{observations.length}</p>
          </div>
          <div className="bg-purple-900/50 rounded-lg p-3 text-center border border-purple-500">
            <p className="text-xs text-purple-300">Recording</p><p className="font-bold">{recording ? 'Active' : 'Off'}</p>
          </div>
        </div>

        {fieldMeasurement && (
          <div className="bg-purple-900/50 rounded-lg p-3 mb-4 border border-purple-500">
            <p className="text-xs text-purple-300">Recorded field measurement</p>
            <p className="font-semibold">{fieldMeasurement}</p>
          </div>
        )}

        {message && <p className="bg-black/30 rounded-lg p-3 mb-4 text-sm" role="status">{message}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={exportSession} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-lg font-semibold">
            📦 Export Session
          </button>
          <button type="button" onClick={shareSession} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-3 rounded-lg font-semibold">
            📤 Share Session
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-purple-500 flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400" type="button"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button onClick={() => router.push('/ar')} className="flex flex-col items-center text-slate-400" type="button"><span className="text-xl">🛸</span><span className="text-xs">AR</span></button>
        <button onClick={() => router.push('/vr')} className="flex flex-col items-center text-purple-500" type="button"><span className="text-xl">🥽</span><span className="text-xs">VR</span></button>
        <button onClick={() => router.push('/quantum')} className="flex flex-col items-center text-slate-400" type="button"><span className="text-xl">⚛️</span><span className="text-xs">Quantum</span></button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400" type="button"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
      </nav>
    </div>
  )
}
