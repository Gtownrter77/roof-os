'use client'

import { useState } from 'react'

export default function SnapPage() {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  async function onFile(file: File) {
    setError(''); setDone(''); setDraft(''); setNote('')
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
    else {
      setDraft(body.address || '')
      setNote(body.note || '')
    }
    setBusy(false)
  }

  async function verify() {
    setBusy(true)
    const res = await fetch('/api/public/snap/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: draft }) })
    const body = await res.json()
    if (!res.ok) setError(body.error ?? 'Could not save.')
    else setDone('Verified. The shop has the file. A person still sends the estimate.')
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold">Snap a roof</h1>
      <p className="text-sm text-gray-600 mb-4">Drop the photo. We draft the address. You say yes.</p>
      <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file) }} className="mb-3 text-sm" />
      {busy && <p className="text-sm text-gray-500 mb-3">Reading the photo…</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {note && <p className="text-xs text-gray-500 mb-2">{note}</p>}
      {draft !== '' && (
        <>
          <p className="text-sm font-semibold mb-1">Is this your house?</p>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm mb-3" />
          <button disabled={busy || !draft.trim()} onClick={() => void verify()} className="w-full bg-blue-600 text-white py-3 rounded font-semibold disabled:opacity-50">Yes — that is my house</button>
        </>
      )}
      {done && <p className="text-sm text-green-700 mt-3">{done}</p>}
    </div>
  )
}
