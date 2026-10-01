'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
  }, [supabase.auth])

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(''); setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError(updateError.message)
    else { setMessage('Password updated. Redirecting…'); window.setTimeout(() => router.replace('/'), 800) }
  }

  if (!ready) return <main className="min-h-screen flex items-center justify-center p-4 text-sm text-gray-600">Preparing password reset…</main>
  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><form onSubmit={updatePassword} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6"><h1 className="text-xl font-bold text-center">Set a new password</h1><p className="text-sm text-gray-500 text-center mt-1 mb-6">Choose a password for faster sign-in next time.</p><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">New password</label><input id="password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full p-3 border rounded-lg mb-4" placeholder="At least 8 characters" /><label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirm">Confirm password</label><input id="confirm" type="password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full p-3 border rounded-lg mb-4" placeholder="Repeat your password" />{message && <p className="text-sm text-green-700 mb-3" role="status">{message}</p>}{error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}<button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">Update password</button></form></main>
}
