'use client'

import { useState } from 'react'

const SLOTS = [
  { key: 'good', label: 'Good', hint: 'Honest repair / cap-out' },
  { key: 'better', label: 'Better', hint: 'Full reroof, mid system' },
  { key: 'best', label: 'Best', hint: 'Full reroof, top system' },
  { key: 'restoration', label: 'Restoration draft', hint: 'Insurance-shaped. Our book. Not Xactimate.' },
]

export default function PipelinePage() {
  const [address, setAddress] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [squares, setSquares] = useState('25')
  const [approved, setApproved] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Photo → packet</h1>
      <p className="text-sm text-gray-600 mb-4">Vision drafts the address. NOAA drafts storm dates. We draft four numbers. You confirm every step.</p>

      <section className="bg-white rounded-lg shadow p-4 mb-3">
        <p className="font-semibold text-sm">1. Photo</p>
        <p className="text-xs text-gray-500">Use Camera on a lead. Vision-to-address is not wired. You type what you see tonight.</p>
      </section>

      <section className="bg-white rounded-lg shadow p-4 mb-3 space-y-2">
        <p className="font-semibold text-sm">2. Address</p>
        <input value={address} onChange={(e) => { setAddress(e.target.value); setConfirmed(false) }} placeholder="123 Main, Powder Springs, GA" className="w-full border rounded p-2 text-sm" />
        <button disabled={!address} onClick={() => setConfirmed(true)} className="w-full bg-gray-900 text-white py-2 rounded text-sm disabled:opacity-50">I confirm this address</button>
        {confirmed && <p className="text-xs text-green-700">Address locked for this draft.</p>}
      </section>

      <section className="bg-white rounded-lg shadow p-4 mb-3">
        <p className="font-semibold text-sm">3. Storm candidates</p>
        <p className="text-xs text-gray-500">When wired: NWS + NOAA events for hail and damaging wind near this point. Listed as candidates. Never “this roof was hit.”</p>
        <p className="text-xs mt-2">{confirmed ? 'Ready to query NWS for this address.' : 'Confirm the address first.'}</p>
      </section>

      <section className="bg-white rounded-lg shadow p-4 mb-3 space-y-2">
        <p className="font-semibold text-sm">4. Draft squares</p>
        <input value={squares} onChange={(e) => setSquares(e.target.value)} className="w-full border rounded p-2 text-sm" inputMode="decimal" />
        <p className="text-xs text-gray-500">OSM footprint assist later. Not a certified aerial.</p>
      </section>

      <section className="bg-white rounded-lg shadow p-4 mb-3">
        <p className="font-semibold text-sm">5. Code family</p>
        <p className="text-xs text-gray-500">State family only. Link the building department. We do not paste the code book.</p>
      </section>

      <section className="bg-white rounded-lg shadow p-4 mb-3">
        <p className="font-semibold text-sm mb-2">6. Four drafts</p>
        {SLOTS.map((slot) => (
          <div key={slot.key} className="border rounded p-2 mb-2">
            <p className="text-sm font-medium">{slot.label}</p>
            <p className="text-xs text-gray-500">{slot.hint}</p>
            <p className="text-xs text-amber-800 mt-1">DRAFT · {squares} sq · not sent</p>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <p className="font-semibold text-sm">7. Send + sign</p>
        <label className="flex items-start gap-2 text-sm mt-2">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          <span>I reviewed this packet. Email and signature may go out.</span>
        </label>
        <button disabled={!approved || !confirmed} className="mt-3 w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50">Send is not wired yet</button>
        <p className="text-xs text-gray-500 mt-2">Signature path later: Documenso or equal. Not tonight.</p>
      </section>
    </div>
  )
}
