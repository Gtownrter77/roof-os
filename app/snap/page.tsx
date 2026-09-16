'use client'

import { useState } from 'react'

export default function SnapPage() {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [packet, setPacket] = useState<any>(null)

  async function onFile(file: File) {
    setError(''); setPacket(null); setDraft(''); setNote('')
    if (file.size > 4_000_000) { setError('Photo is too large. Under 4MB.'); return }
    setBusy(true)
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach((b) => { binary += String.fromCharCode(b) })
    const image = `data:${file.type || 'image/jpeg'};base64,${btoa(binary)}`
    const res = await fetch('/api/public/snap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image }) })
    const body = await res.json()
    if (!res.ok) setError(body.error ?? 'Could not read the photo.')
    else { setDraft(body.address || ''); setNote(body.note || '') }
    setBusy(false)
  }

  async function verify() {
    setBusy(true); setError('')
    const save = await fetch('/api/public/snap/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: draft }) })
    const saved = await save.json()
    if (!save.ok) { setError(saved.error ?? 'Could not save.'); setBusy(false); return }
    const pack = await fetch('/api/public/packet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: draft }) })
    const body = await pack.json()
    if (!pack.ok) setError(body.error ?? 'Packet failed.')
    else setPacket(body)
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Snap a roof</h1>
      <p className="text-sm text-gray-600 mb-4">Photo first. Verify. Then the packet. No dollars without squares.</p>
      <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file) }} className="mb-3 text-sm" />
      {busy && <p className="text-sm text-gray-500 mb-3">Working…</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {note && <p className="text-xs text-gray-500 mb-2">{note}</p>}
      {draft !== '' && !packet && (
        <>
          <p className="text-sm font-semibold mb-1">Is this your house?</p>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm mb-3" />
          <button disabled={busy || !draft.trim()} onClick={() => void verify()} className="w-full bg-blue-600 text-white py-3 rounded font-semibold disabled:opacity-50">Yes — run the packet</button>
        </>
      )}
      {packet && (
        <div className="bg-white rounded-lg shadow p-4 text-sm space-y-2 mt-3">
          <p className="font-semibold">{packet.address}</p>
          <p>{packet.lat}, {packet.lon}</p>
          <p>NWS {packet.nws?.office} · {packet.nws?.zone}</p>
          <p>Alerts: {(packet.nws?.alerts || []).join('; ') || 'none active'}</p>
          <p>Footprint sqft: {packet.measure?.footprint_sqft || 'none'}</p>
          <p>Plan-view squares: {packet.measure?.squares_from_footprint || 'none'}</p>
          <p className="text-amber-800">{packet.measure?.note}</p>
          <p className="text-xs text-gray-500">{packet.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
