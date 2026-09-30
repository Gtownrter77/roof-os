'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authCooldownSeconds } from '../../../lib/auth/cooldown'
import { createClient } from '../../../lib/supabase/client'
import { safeNextPath } from '../../../lib/safe-next'

const SUCCESSFUL_SEND_COOLDOWN_SECONDS = 60
type SignInMode = 'link' | 'code' | 'password'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = safeNextPath(search.get('next'), typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin)
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<SignInMode>('link')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendCooldown, setSendCooldown] = useState(0)
  const [verifyCooldown, setVerifyCooldown] = useState(0)

  useEffect(() => {
    if (search.get('error') === 'auth_callback_failed') setError('That sign-in link could not be verified. Request a new sign-in email and try again.')
  }, [search])

  useEffect(() => {
    if (!sendCooldown && !verifyCooldown) return
    const timer = window.setInterval(() => {
      setSendCooldown((seconds) => Math.max(0, seconds - 1))
      setVerifyCooldown((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [sendCooldown, verifyCooldown])

  function changeMode(nextMode: SignInMode) {
    setMode(nextMode)
    setCodeSent(false)
    setCode('')
    setPassword('')
    setMessage('')
    setError('')
  }

  async function sendSignInEmail() {
    if (sendCooldown > 0 || loading) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail) { setError('Enter your email address first.'); return }
    setLoading(true); setMessage(''); setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      if (signInError) {
        const retrySeconds = authCooldownSeconds(signInError)
        if (retrySeconds) {
          setSendCooldown(retrySeconds)
          setError(`Too many sign-in requests. Please wait ${retrySeconds} seconds before requesting another email.`)
        } else setError('A sign-in email could not be sent. Check the address and try again.')
        return
      }
      setSendCooldown(SUCCESSFUL_SEND_COOLDOWN_SECONDS)
      if (mode === 'code') {
        setCodeSent(true)
        setMessage('A 6-digit email code was requested. If your email also includes a secure sign-in link, you can use that instead.')
      } else setMessage('Check your email for a secure sign-in link. You can also switch to the 6-digit code option if needed.')
    } catch {
      setError('A sign-in email could not be sent right now. Please try again.')
    } finally { setLoading(false) }
  }

  async function verifyEmailCode() {
    if (loading || verifyCooldown > 0) return
    const normalizedEmail = email.trim()
    const normalizedCode = code.trim()
    if (!normalizedEmail) { setError('Enter your email address first.'); return }
    if (!/^\d{6}$/.test(normalizedCode)) { setError('Enter the 6-digit code from your email.'); return }
    setLoading(true); setMessage(''); setError('')
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: normalizedCode, type: 'email' })
      if (verifyError) {
        const retrySeconds = authCooldownSeconds(verifyError)
        if (retrySeconds) {
          setVerifyCooldown(retrySeconds)
          setError(`Too many verification attempts. Please wait ${retrySeconds} seconds before trying another code.`)
        } else setError('That code was not accepted or has expired. Check it or request a new sign-in email.')
        return
      }
      router.replace(next); router.refresh()
    } catch {
      setError('The sign-in code could not be verified right now. Please try again.')
    } finally { setLoading(false) }
  }

  async function signInWithPassword() {
    if (loading) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) { setError('Enter your email address and password.'); return }
    setLoading(true); setMessage(''); setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (signInError) setError('Email or password was not accepted.')
      else { router.replace(next); router.refresh() }
    } catch {
      setError('Password sign-in is unavailable right now. Please try again or use an email link.')
    } finally { setLoading(false) }
  }

  async function sendReset() {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) { setError('Enter your email address first.'); return }
    setLoading(true); setMessage(''); setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` })
      if (resetError) setError('A password reset email could not be sent. Check the address and try again.')
      else setMessage('Password reset link sent. Open it in this browser, then choose a new password.')
    } catch {
      setError('A password reset email could not be sent right now. Please try again.')
    } finally { setLoading(false) }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'password') await signInWithPassword()
    else if (mode === 'code' && codeSent) await verifyEmailCode()
    else await sendSignInEmail()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-center">Welcome to ROOF/OS</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">Sign in securely with your work email.</p>
        <div className="grid grid-cols-3 gap-2 mb-5" role="group" aria-label="Sign-in method">
          <button type="button" onClick={() => changeMode('link')} aria-pressed={mode === 'link'} className={`py-2 rounded-lg border text-sm ${mode === 'link' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-gray-300 text-gray-600'}`}>Email link</button>
          <button type="button" onClick={() => changeMode('code')} aria-pressed={mode === 'code'} className={`py-2 rounded-lg border text-sm ${mode === 'code' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-gray-300 text-gray-600'}`}>6-digit code</button>
          <button type="button" onClick={() => changeMode('password')} aria-pressed={mode === 'password'} className={`py-2 rounded-lg border text-sm ${mode === 'password' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-gray-300 text-gray-600'}`}>Password</button>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
        <input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); setCodeSent(false) }} className="w-full p-3 border rounded-lg mb-4" placeholder="you@company.com" />
        {mode === 'password' && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
            <input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full p-3 border rounded-lg mb-4" placeholder="Your password" autoComplete="current-password" />
          </>
        )}
        {mode === 'code' && codeSent && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email-code">6-digit email code</label>
            <input id="email-code" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full p-3 border rounded-lg mb-4 tracking-[0.4em] text-center" placeholder="000000" aria-describedby="email-code-help" />
            <p id="email-code-help" className="text-xs text-gray-500 mb-4">Enter the code sent to {email.trim()}.</p>
          </>
        )}
        {message && <p className="text-sm text-green-700 mb-3" role="status">{message}</p>}
        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
        <button type="submit" disabled={loading || (mode === 'code' && codeSent ? verifyCooldown > 0 : mode !== 'password' ? sendCooldown > 0 : false)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">
          {loading ? mode === 'password' ? 'Signing in…' : mode === 'code' && codeSent ? 'Verifying code…' : 'Sending email…' : mode === 'password' ? 'Sign in' : mode === 'code' && codeSent ? verifyCooldown > 0 ? `Try code again in ${verifyCooldown}s` : 'Verify 6-digit code' : sendCooldown > 0 ? `Request again in ${sendCooldown}s` : mode === 'code' ? 'Send 6-digit code' : 'Send sign-in link'}
        </button>
        {mode === 'password' && <button type="button" onClick={() => void sendReset()} disabled={loading} className="w-full text-gray-600 text-sm mt-3">Forgot password? Send reset link</button>}
        {mode === 'code' && codeSent && <button type="button" onClick={() => void sendSignInEmail()} disabled={loading || sendCooldown > 0} className="w-full text-blue-600 text-sm mt-3 disabled:text-gray-400">{sendCooldown > 0 ? `Resend code in ${sendCooldown}s` : 'Resend code'}</button>}
        <button type="button" onClick={() => router.push('/auth/signup')} className="w-full text-blue-600 text-sm mt-4">Create an account</button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading sign-in…</p>}><LoginForm /></Suspense>
}
