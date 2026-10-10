'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setReady(Boolean(data.session))
      setChecking(false)
    }).catch(() => {
      if (active) setChecking(false)
    })
    return () => { active = false }
  }, [supabase])

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('We could not update your password. Request a fresh reset link and try again.')
    else {
      setMessage('Password updated. Returning to sign in…')
      window.setTimeout(() => router.replace('/auth/enter?reset=success'), 800)
    }
  }

  if (checking) return <main className="min-h-screen flex items-center justify-center p-4 text-sm text-gray-600">Checking your reset link…</main>

  if (!ready) return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg"><h1 className="text-xl font-bold">Reset link needed</h1><p className="mt-2 text-sm text-gray-600">This link is missing or expired. Return to sign in and choose <strong>Forgot password?</strong> to send a fresh link.</p><button type="button" onClick={() => router.replace('/auth/enter')} className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white">Back to sign in</button></section></main>

  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><form onSubmit={updatePassword} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"><h1 className="text-xl font-bold text-center">Set a new password</h1><p className="mt-1 mb-6 text-center text-sm text-gray-500">Choose a password for faster sign-in next time.</p><label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">New password</label><input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mb-4 w-full rounded-lg border p-3" placeholder="At least 8 characters" /><label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirm">Confirm password</label><input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mb-4 w-full rounded-lg border p-3" placeholder="Repeat your password" />{message && <p className="mb-3 text-sm text-green-700" role="status">{message}</p>}{error && <p className="mb-3 text-sm text-red-600" role="alert">{error}</p>}<button type="submit" className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white">Update password</button></form></main>
}
