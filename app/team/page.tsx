'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TeamPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch('/api/team/invitations')
    const body = await res.json()
    if (!res.ok) setMessage(body.error ?? 'Could not load invites.')
    else setRows(body.invitations ?? [])
  }

  useEffect(() => { void load() }, [])

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    const res = await fetch('/api/team/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role: 'member' }) })
    const body = await res.json()
    setMessage(body.warning || body.error || 'Invite recorded.')
    if (res.ok) { setEmail(''); await load() }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/third10')} className="text-blue-600 text-sm mb-3">Third 10</button>
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="text-sm text-gray-600 mb-4">Saves an invite record. Email delivery is not live yet.</p>
      <form onSubmit={invite} className="bg-white rounded-lg shadow p-4 mb-4 space-y-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="helper@shop.com" className="w-full border rounded p-2 text-sm" />
        <button className="w-full bg-blue-600 text-white py-2 rounded font-semibold">Record invite</button>
      </form>
      {message && <p className="text-sm text-amber-800 mb-3">{message}</p>}
      {rows.map((row) => (
        <div key={row.id} className="bg-white rounded-lg shadow p-3 mb-2 text-sm">{row.email} · {row.role} · {row.status}</div>
      ))}
    </div>
  )
}
