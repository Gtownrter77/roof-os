'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type CountValue = number | '—'

type Counts = {
  members: CountValue
  leads: CountValue
  inspections: CountValue
  photos: CountValue
}

const emptyCounts: Counts = {
  members: '—',
  leads: '—',
  inspections: '—',
  photos: '—',
}

export default function AdminPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Loading admin access…')
  const [counts, setCounts] = useState<Counts>(emptyCounts)
  const [role, setRole] = useState('')
  const [ready, setReady] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAdmin() {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        if (!cancelled) {
          setStatus('Sign in required.')
          setReady(true)
        }
        return
      }

      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
        .limit(1)
        .maybeSingle()

      if (membershipError || !membership) {
        if (!cancelled) {
          setStatus('Admin access is not enabled for this account.')
          setReady(true)
        }
        return
      }

      const workspaceId = membership.workspace_id
      const [members, leads, inspections, photos] = await Promise.all([
        supabase.from('workspace_members').select('user_id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('inspection_sessions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      ])

      if (cancelled) return
      setRole(membership.role)
      setCounts({
        members: members.error ? '—' : members.count ?? 0,
        leads: leads.error ? '—' : leads.count ?? 0,
        inspections: inspections.error ? '—' : inspections.count ?? 0,
        photos: photos.error ? '—' : photos.count ?? 0,
      })
      setStatus('Showing data for your current workspace.')
      setReady(true)
    }

    void loadAdmin()
    return () => { cancelled = true }
  }, [])

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (newPassword.length < 12) {
      setPasswordError('Use at least 12 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The passwords do not match.')
      return
    }

    setSavingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError('Password was not changed. Sign in again or use password recovery.')
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password changed.')
    } catch {
      setPasswordError('Password was not changed. Try again.')
    } finally {
      setSavingPassword(false)
    }
  }

  const tiles: { label: string; value: CountValue }[] = [
    { label: 'Workspace members', value: counts.members },
    { label: 'Leads', value: counts.leads },
    { label: 'Inspections', value: counts.inspections },
    { label: 'Photos', value: counts.photos },
  ]

  if (ready && status === 'Admin access is not enabled for this account.') {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
        <section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6">
          <h1 className="text-2xl font-bold">Admin access</h1>
          <p className="mt-3 text-slate-300">{status}</p>
          <button onClick={() => router.push('/')} className="mt-6 rounded-lg bg-white px-4 py-3 font-semibold text-slate-950">Back home</button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-24 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">ROOF/OS</p>
            <h1 className="mt-1 text-2xl font-black">Admin</h1>
          </div>
          <button onClick={() => router.push('/')} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Home</button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <p className="text-sm text-slate-300">{status}</p>
          {role && <p className="mt-2 text-xs uppercase tracking-wider text-cyan-300">Access: {role}</p>}
          {!ready && <p className="mt-3 text-sm text-slate-400">Checking your account and workspace…</p>}
          {ready && status === 'Sign in required.' && (
            <button onClick={() => router.push('/auth/login')} className="mt-4 rounded-lg bg-red-600 px-4 py-3 font-semibold">Sign in</button>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Workspace overview</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <article key={tile.label} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">{tile.label}</p>
                <p className="mt-2 text-3xl font-black tabular-nums">{tile.value}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">A dash means the count could not be read. Revenue and storage are not reported here.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Account security</p>
            <h2 className="mt-1 text-xl font-bold">Change your password</h2>
            <p className="mt-2 text-sm text-slate-400">This works only while you are signed in. If you are locked out, use Forgot password on the sign-in page.</p>
          </div>
          <form onSubmit={changePassword} className="mt-5 max-w-xl space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm text-slate-300">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm text-slate-300">Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white" />
            </div>
            {passwordError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{passwordError}</p>}
            {passwordMessage && <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">{passwordMessage}</p>}
            <button type="submit" disabled={savingPassword || !role} className="rounded-lg bg-red-600 px-5 py-3 font-bold disabled:opacity-50">{savingPassword ? 'Saving…' : 'Set new password'}</button>
          </form>
        </section>

        <nav className="flex flex-wrap gap-3 border-t border-white/10 pt-5 text-sm">
          <button onClick={() => router.push('/leads')} className="rounded-lg border border-white/15 px-4 py-3">Leads</button>
          <button onClick={() => router.push('/settings')} className="rounded-lg border border-white/15 px-4 py-3">Settings</button>
          <button onClick={() => router.push('/profile')} className="rounded-lg border border-white/15 px-4 py-3">Profile</button>
        </nav>
      </div>
    </main>
  )
}
