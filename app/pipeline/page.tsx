'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SLOTS = [
  { key: 'good', label: 'Good' },
  { key: 'better', label: 'Better' },
  { key: 'best', label: 'Best' },
  { key: 'restoration', label: 'Restoration draft' },
]

export default function PipelinePage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [packet, setPacket] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true); setError('')
    const res = await fetch('/api/public/packet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) })
    const body = await res.json()
    if (!res.ok) setError(body.error ?? 'Packet failed.')
    else setPacket(body)
    setBusy(false)
  }

  const squares = packet?.measure?.squares_from_footprint || 0

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/snap')} className="text-blue-600 text-sm mb-3">Snap photo first</button>
      <h1 className="text-2xl font-bold">Packet</h1>
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Verified address" className="w-full border rounded p-2 text-sm mb-2" />
      <button disabled={busy || address.length < 8} onClick={() => void run()} className="w-full bg-gray-900 text-white py-2 rounded mb-4 disabled:opacity-50">Run packet</button>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {packet && (
        <div className="bg-white rounded-lg shadow p-4 text-sm space-y-2">
          <p className="font-semibold">{packet.address}</p>
          <p>{packet.lat}, {packet.lon}</p>
          <p>NWS {packet.nws?.office} {packet.nws?.zone}</p>
          <p>Alerts: {(packet.nws?.alerts || []).join('; ') || 'none'}</p>
          <p>Footprint {packet.measure?.footprint_sqft || 0} sqft</p>
          <p>Plan-view squares {squares || 'none'}</p>
          <p className="text-amber-800">{packet.measure?.note}</p>
          {SLOTS.map((slot) => (
            <div key={slot.key} className="border rounded p-2">{slot.label} · {squares ? `${squares} sq plan-view` : 'no squares'} · DRAFT</div>
          ))}
          <p className="text-xs text-gray-500">{packet.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
