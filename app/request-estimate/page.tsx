'use client'

import { useState } from 'react'

export default function RequestEstimatePage() {
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', notes: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setMessage('')
    const res = await fetch('/api/public/estimate-request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await res.json()
    if (!res.ok) setError(body.error ?? 'Could not send.')
    else setMessage('Got it. A person at the shop will review before anything is emailed back. No number goes out on its own.')
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold">Request an estimate</h1>
      <p className="text-sm text-gray-600 mb-4">A photo helps. It does not replace your address. Listing pictures have no GPS.</p>
      <form onSubmit={submit} className="space-y-3 max-w-lg">
        <input required placeholder="Your name" className="w-full border rounded p-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required placeholder="Property address *" className="w-full border rounded p-3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input placeholder="Phone" className="w-full border rounded p-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input type="email" placeholder="Email" className="w-full border rounded p-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <textarea placeholder="What do you see? Hail? Leak? How many years on the roof?" className="w-full border rounded p-3" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <p className="text-xs text-gray-500">Photo upload to Storage comes next. For now the shop matches the picture you already sent once the address is on the file.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded font-semibold disabled:opacity-50">{saving ? 'Sending…' : 'Send to the shop'}</button>
      </form>
    </div>
  )
}
