'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoginWeatherPreview, { type LoginPreviewData } from '../../../components/LoginWeatherPreview'
import WeatherRadarMap from '../../../components/WeatherRadarMap'
import { authCooldownSeconds } from '../../../lib/auth/cooldown'
import { createClient } from '../../../lib/supabase/client'
import { safeNextPath } from '../../../lib/safe-next'

const SUCCESSFUL_SEND_COOLDOWN_SECONDS = 60

type SignInMode = 'password' | 'link' | 'code'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = safeNextPath(search.get('next'), typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin)
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<SignInMode>('password')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendCooldown, setSendCooldown] = useState(0)
  const [verifyCooldown, setVerifyCooldown] = useState(0)
  const [weatherPreview, setWeatherPreview] = useState<LoginPreviewData | null>(null)

  useEffect(() => {
    if (search.get('error') === 'auth_callback_failed') {
      setError('That sign-in link could not be verified. Request a new sign-in email and try again.')
    }
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
    setMessage('')
    setError('')
  }

  async function signInWithPassword() {
    if (loading) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError('Enter your email address and password.')
      return
    }

    setLoading(true)
    setMessage('')
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (signInError) {
        setError('Email or password was not accepted. Check both fields and try again.')
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError('Password sign-in is temporarily unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function sendSignInEmail() {
    if (sendCooldown > 0 || loading) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError('Enter your email address first.')
      return
    }

    setLoading(true)
    setMessage('')
    setError('')
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
        } else {
          setError('A sign-in email could not be sent. Check the address and try again.')
        }
        return
      }
      setSendCooldown(SUCCESSFUL_SEND_COOLDOWN_SECONDS)
      if (mode === 'code') {
        setCodeSent(true)
        setMessage('A 6-digit email code was requested. If your email also includes a secure sign-in link, you can use that instead.')
      } else {
        setMessage('Check your email for a secure sign-in link. You can also switch to the 6-digit code option if needed.')
      }
    } catch {
      setError('A sign-in email could not be sent right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyEmailCode() {
    if (loading || verifyCooldown > 0) return
    const normalizedEmail = email.trim()
    const normalizedCode = code.trim()
    if (!normalizedEmail) {
      setError('Enter your email address first.')
      return
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setLoading(true)
    setMessage('')
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: normalizedCode, type: 'email' })
      if (verifyError) {
        const retrySeconds = authCooldownSeconds(verifyError)
        if (retrySeconds) {
          setVerifyCooldown(retrySeconds)
          setError(`Too many verification attempts. Please wait ${retrySeconds} seconds before trying another code.`)
        } else {
          setError('That code was not accepted or has expired. Check it or request a new sign-in email.')
        }
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError('The sign-in code could not be verified right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'password') await signInWithPassword()
    else if (mode === 'code' && codeSent) await verifyEmailCode()
    else await sendSignInEmail()
  }
  const submitCooldown = mode === 'password' ? 0 : mode === 'code' && codeSent ? verifyCooldown : sendCooldown

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b14] text-slate-100">
      {weatherPreview && <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true"><WeatherRadarMap latitude={weatherPreview.latitude} longitude={weatherPreview.longitude} locationLabel={weatherPreview.label} refreshKey={weatherPreview.checkedAt} interactive={false} showBadge={false} className="h-full w-full rounded-none border-0" /></div>}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_15%_8%,rgba(26,91,148,0.28),transparent_40%),linear-gradient(90deg,rgba(5,8,15,0.88),rgba(5,8,15,0.65)),radial-gradient(ellipse_at_86%_72%,rgba(146,25,48,0.2),transparent_38%)]" />
      <header className="relative z-10 border-b border-white/10 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/auth/login" className="text-xl font-black tracking-tight text-white">ROOF<span className="text-red-500">/</span>OS</Link>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:inline">The roofing operating system</span>
          <Link href="/help" className="text-xs text-slate-300 hover:text-white">Help</Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl items-start gap-6 px-4 py-8 md:px-6 md:py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:items-center">
        <section className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Built for roofing work</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">A clear record<br className="hidden md:block" /> for every roof.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Manage lead records, field inspections, photo evidence, technician-reviewed measurements, report drafts, owner pricing, and warranty follow-up in one workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="ROOF/OS workflow areas">
            {['Leads', 'Inspections', 'Photo reports', 'Measurements', 'Price book', 'Warranties'].map((label) => <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">{label}</span>)}
          </div>
          <LoginWeatherPreview onLocationChange={setWeatherPreview} />
        </section>

        <section className="w-full rounded-2xl border border-white/10 bg-slate-950/85 p-5 shadow-2xl backdrop-blur md:p-7" aria-labelledby="login-title">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Workspace access</p>
          <h2 id="login-title" className="mt-2 text-2xl font-black text-white">Sign in to ROOF/OS</h2>
          <p className="mb-6 mt-1 text-sm text-slate-400">Use your work email to open the records available to your workspace.</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-5 grid grid-cols-3 gap-2" role="group" aria-label="Sign-in method">
              <button type="button" onClick={() => changeMode('password')} aria-pressed={mode === 'password'} className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${mode === 'password' ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>Password</button>
              <button type="button" onClick={() => changeMode('link')} aria-pressed={mode === 'link'} className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${mode === 'link' ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>Email link</button>
              <button type="button" onClick={() => changeMode('code')} aria-pressed={mode === 'code'} className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${mode === 'code' ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>6-digit code</button>
            </div>

            <label className="mb-1 block text-sm font-medium text-slate-200" htmlFor="email">Work email</label>
            <input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); setCodeSent(false) }} className="mb-4 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" placeholder="you@company.com" />

            {mode === 'password' && <>
              <label className="mb-1 block text-sm font-medium text-slate-200" htmlFor="password">Password</label>
              <input id="password" type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mb-4 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" placeholder="Enter your password" />
            </>}

            {mode === 'code' && codeSent && <>
              <label className="mb-1 block text-sm font-medium text-slate-200" htmlFor="email-code">6-digit email code</label>
              <input id="email-code" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mb-2 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-3 text-center tracking-[0.4em] text-white outline-none focus:border-cyan-300" placeholder="000000" aria-describedby="email-code-help" />
              <p id="email-code-help" className="mb-4 text-xs text-slate-400">Enter the code sent to {email.trim()}.</p>
            </>}

            {message && <p className="mb-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100" role="status">{message}</p>}
            {error && <p className="mb-3 rounded-lg border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100" role="alert">{error}</p>}

            <button type="submit" disabled={loading || submitCooldown > 0} className="w-full rounded-lg bg-red-600 py-3 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? mode === 'password' ? 'Signing in…' : mode === 'code' && codeSent ? 'Verifying code…' : 'Sending email…' : mode === 'password' ? 'Sign in with password' : mode === 'code' && codeSent ? verifyCooldown > 0 ? `Try code again in ${verifyCooldown}s` : 'Verify 6-digit code' : sendCooldown > 0 ? `Request again in ${sendCooldown}s` : mode === 'code' ? 'Send 6-digit code' : 'Send sign-in link'}
            </button>

            {mode === 'code' && codeSent && <button type="button" onClick={() => void sendSignInEmail()} disabled={loading || sendCooldown > 0} className="mt-3 w-full text-sm text-cyan-200 disabled:text-slate-500">{sendCooldown > 0 ? `Resend code in ${sendCooldown}s` : 'Resend code'}</button>}
            <button type="button" onClick={() => router.push('/auth/signup')} className="mt-4 w-full text-sm text-slate-300 hover:text-white">Create an account</button>
          </form>
          <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500">Workspace data and tools depend on your membership. Weather preview is optional and does not change sign-in or save your device location.</p>
        </section>
      </main>

      <footer className="relative z-10 mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-500 md:px-6">We educate. You decide. · AI does not approve measurements, prices, insurance decisions, or engineering determinations.</footer>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#070b14] p-8 text-sm text-slate-400">Loading secure sign-in…</div>}><LoginForm /></Suspense>
}
