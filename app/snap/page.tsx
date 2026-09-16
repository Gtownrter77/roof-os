'use client'

import { useState } from 'react'

export default function SnapPage() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [verified, setVerified] = useState(false)

  async function onFile(file: File) {
    setError(''); setResult(null); setVerified(false)
    if (file.size > 4_000_000) { setError('Photo under 4MB.'); return }
    setBusy(true)
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach((b) => { binary += String.fromCharCode(b) })
    const image = `data:${file.type || 'image/jpeg'};base64,${btoa(binary)}`
    const res = await fetch('/api/public/photo-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image }) })
    const body = await res.json()
    if (!res.ok) setError(body.error ?? 'Failed.')
    else setResult(body)
    setBusy(false)
  }

  async function confirm() {
    if (!result?.address) return
    setBusy(true)
    await fetch('/api/public/snap/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: result.address }) })
    setVerified(true)
    setBusy(false)
  }

  const e = result?.estimates

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Photo → estimate</h1>
      <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(ev) => { const file = ev.target.files?.[0]; if (file) void onFile(file) }} className="my-3 text-sm" />
      {busy && <p className="text-sm">Working…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="bg-white rounded-lg shadow p-4 text-sm space-y-2">
          <p className="font-semibold">{result.address}</p>
          <p>Squares (plan-view): {result.measure?.planViewSquares || 'none'}</p>
          <p className="text-amber-800">{result.measure?.note}</p>
          {e ? (
            <>
              <p>Good ${e.good.amount.toLocaleString()}</p>
              <p>Better ${e.better.amount.toLocaleString()}</p>
              <p>Best ${e.best.amount.toLocaleString()}</p>
              <p>Restoration ${e.restoration.amount.toLocaleString()}</p>
            </>
          ) : <p>No footprint. No dollars.</p>}
          {!verified && <button disabled={busy} onClick={() => void confirm()} className="w-full bg-blue-600 text-white py-2 rounded font-semibold">Yes this is the house — keep the file</button>}
          {verified && <p className="text-green-700">Verified. Not emailed.</p>}
        </div>
      )}
    </div>
  )
}
