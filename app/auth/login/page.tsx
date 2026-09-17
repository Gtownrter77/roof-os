'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { safeNextPath } from '../../../lib/safe-next'

const COOLDOWN_SECONDS = 60

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = safeNextPath(search.get('next'), typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin)
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(search.get('error') === 'auth_callback_failed' ? 'That sign-in link expired or was already used. Sign in with your password or request a new link.' : '')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (cooldown > 0) return
    setLoading(true); setMessage(''); setError('')
    if (password.trim()) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) setError(signInError.message)
      else router.replace(next)
      setLoading(false)
      return
    }
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (signInError) {
      setError(signInError.message)
      if (/rate limit|too many|429/i.test(signInError.message)) setCooldown(COOLDOWN_SECONDS)
    } else {
      setMessage('Check your email for a secure sign-in link. Or enter your password next time for one-click sign-in.')
      setCooldown(COOLDOWN_SECONDS)
    }
    setLoading(false)
  }

  async function sendReset() {
    if (!email.trim()) { setError('Enter your email first.'); return }
    setLoading(true); setMessage(''); setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` })
    if (resetError) setError(resetError.message)
    else setMessage('Password reset link sent. Open it in this browser, then choose a password.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-center">Welcome to ROOF/OS</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">Sign in with your password, or use a secure email link.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full p-3 border rounded-lg mb-3" placeholder="you@company.com" />
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password <span className="font-normal text-gray-400">(optional for email link)</span></label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full p-3 border rounded-lg mb-4" placeholder="Your password" />
        {message && <p className="text-sm text-green-700 mb-3" role="status">{message}</p>}
        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
        <button type="submit" disabled={loading || cooldown > 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">{loading ? 'Signing in…' : password.trim() ? 'Sign in' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send sign-in link'}</button>
        <button type="button" onClick={() => void sendReset()} disabled={loading} className="w-full text-gray-600 text-sm mt-3">Forgot password? Send reset link</button>
        <button type="button" onClick={() => router.push('/auth/signup')} className="w-full text-blue-600 text-sm mt-4">Create an account</button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading sign-in…</p>}><LoginForm /></Suspense>
}
