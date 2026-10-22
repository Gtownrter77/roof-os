'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

type Invitation = {
  id: string
  email: string
  role: 'admin' | 'member' | string
  status: string
  expires_at: string
  created_at: string
}

export default function TeamPage() {
  const router = useRouter()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadInvitations() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/team/invitations', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not load workspace invitations.')
      setInvitations(Array.isArray(payload.invitations) ? payload.invitations : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load workspace invitations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvitations()
  }, [])

  async function sendInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/team/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'The invitation could not be sent.')
      setEmail('')
      setRole('member')
      setMessage(`Invitation email sent to ${payload.invitation?.email ?? 'the new member'}.`)
      await loadInvitations()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The invitation could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <header className="glass flex items-center rounded-xl px-4 py-3">
        <button type="button" onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
        <div>
          <h1 className="text-xl font-bold">Workspace Team</h1>
          <p className="text-xs text-slate-400">View invitations and add workspace members.</p>
        </div>
      </header>

      <section className="glass space-y-3 rounded-xl p-4">
        <h2 className="font-semibold">Invite a teammate</h2>
        <p className="text-sm text-slate-300">Invitations are sent by email. Admin access includes elevated workspace permissions; only grant it to trusted people.</p>
        <form onSubmit={sendInvitation} className="space-y-3">
          <label className="block text-sm">
            Email address
            <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ops-input mt-1 w-full" placeholder="teammate@example.com" />
          </label>
          <label className="block text-sm">
            Workspace role
            <select value={role} onChange={(event) => setRole(event.target.value as 'member' | 'admin')} className="ops-input mt-1 w-full">
              <option value="member">Member</option>
              <option value="admin">Admin — elevated workspace permissions</option>
            </select>
          </label>
          <button type="submit" disabled={sending || loading} className="w-full rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? 'Sending invitation…' : 'Send invitation email'}
          </button>
        </form>
        {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      </section>

      <section className="glass space-y-3 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Workspace invitations</h2>
          <button type="button" onClick={() => void loadInvitations()} disabled={loading} className="rounded border border-white/20 px-3 py-1.5 text-sm disabled:opacity-50">Refresh</button>
        </div>
        {loading ? <p className="text-sm text-slate-400">Loading invitations…</p> : invitations.length === 0 ? <p className="text-sm text-slate-400">No invitations to show.</p> : (
          <ul className="divide-y divide-white/10">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-xs text-slate-400">{invitation.role} · {new Date(invitation.created_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full border border-white/20 px-2 py-1 text-xs">{invitation.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
