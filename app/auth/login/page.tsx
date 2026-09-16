'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const COOLDOWN_SECONDS = 60

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = safeNext(search.get('next'))
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (cooldown > 0) return
    setLoading(true); setMessage(''); setError('')
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (signInError) {
      setError(signInError.message)
      if (/rate limit|too many|429/i.test(signInError.message)) setCooldown(COOLDOWN_SECONDS)
    } else {
      setMessage('Check your email for a secure sign-in link.')
      setCooldown(COOLDOWN_SECONDS)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-center">Welcome to ROOF/OS</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">Sign in securely with your work email.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full p-3 border rounded-lg mb-4" placeholder="you@company.com" />
        {message && <p className="text-sm text-green-700 mb-3">{message}</p>}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button type="submit" disabled={loading || cooldown > 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">{loading ? 'Sending link…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send sign-in link'}</button>
        <button type="button" onClick={() => router.push('/auth/signup')} className="w-full text-blue-600 text-sm mt-4">Create an account</button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading sign-in…</p>}><LoginForm /></Suspense>
}
