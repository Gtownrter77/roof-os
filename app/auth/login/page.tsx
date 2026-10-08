'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, Zap } from 'lucide-react'
import { authCooldownSeconds } from '../../../lib/auth/cooldown'
import { createClient } from '../../../lib/supabase/client'
import { safeNextPath } from '../../../lib/safe-next'

type Mode = 'password' | 'link' | 'code'
const COOLDOWN = 60
const RESET_COOLDOWN_KEY = 'roof-os-password-reset-cooldown:'

function resetCooldownKey(email: string) {
  return `${RESET_COOLDOWN_KEY}${email.trim().toLowerCase()}`
}

function storedResetCooldown(email: string) {
  if (typeof window === 'undefined' || !email.trim()) return 0
  try {
    const expiresAt = Number(window.localStorage.getItem(resetCooldownKey(email)))
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  } catch {
    return 0
  }
}

function rememberResetCooldown(email: string, seconds: number) {
  try {
    window.localStorage.setItem(resetCooldownKey(email), String(Date.now() + seconds * 1000))
  } catch {
    // Some privacy modes disable localStorage; the in-memory timer still protects this page.
  }
}

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()
  const next = safeNextPath(search.get('next'), typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<Mode>('password')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendCooldown, setSendCooldown] = useState(0)
  const [verifyCooldown, setVerifyCooldown] = useState(0)
  const [resetCooldown, setResetCooldown] = useState(0)

  useEffect(() => {
    if (search.get('error') === 'auth_callback_failed') {
      setError('That sign-in link could not be verified. Request a new sign-in email and try again.')
    }
    if (search.get('reset') === 'success') {
      setMessage('Your password was updated. Sign in with it below.')
    }
  }, [search])

  useEffect(() => {
    if (!sendCooldown && !verifyCooldown && !resetCooldown) return
    const timer = window.setInterval(() => {
      setSendCooldown((seconds) => Math.max(0, seconds - 1))
      setVerifyCooldown((seconds) => Math.max(0, seconds - 1))
      setResetCooldown((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [sendCooldown, verifyCooldown, resetCooldown])

  function changeMode(nextMode: Mode) {
    setMode(nextMode)
    setCodeSent(false)
    setCode('')
    setMessage('')
    setError('')
  }

  async function signInWithPassword() {
    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) {
        setError('Email or password was not accepted. Use Forgot password? if you need a new password.')
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError('Password sign-in is temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Enter your email address first, then choose Forgot password?.')
      return
    }
    const rememberedSeconds = storedResetCooldown(normalizedEmail)
    if (rememberedSeconds) {
      setResetCooldown(rememberedSeconds)
      setError(`A reset email may already be on its way. Please wait ${rememberedSeconds} seconds before requesting another.`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      })
      if (resetError) {
        const seconds = authCooldownSeconds(resetError)
        if (seconds) {
          setResetCooldown(seconds)
          rememberResetCooldown(normalizedEmail, seconds)
          setError(`A reset email may already be on its way. Please wait ${seconds} seconds before requesting another.`)
        }
        else setError('A password reset email could not be sent.')
        return
      }
      setResetCooldown(COOLDOWN)
      rememberResetCooldown(normalizedEmail, COOLDOWN)
      setMessage('Check your email for a password reset link. Open it on this device, then choose a new password.')
    } catch {
      setError('A password reset email could not be sent right now.')
    } finally {
      setLoading(false)
    }
  }

  async function sendSignInEmail() {
    if (sendCooldown || loading) return
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      if (signInError) {
        const seconds = authCooldownSeconds(signInError)
        if (seconds) {
          setSendCooldown(seconds)
          setError(`Too many sign-in requests. Please wait ${seconds} seconds.`)
        } else setError('A sign-in email could not be sent.')
        return
      }
      setSendCooldown(COOLDOWN)
      if (mode === 'code') {
        setCodeSent(true)
        setMessage('A 6-digit email code was requested. Check your inbox.')
      } else setMessage('Check your email for a secure sign-in link.')
    } catch {
      setError('A sign-in email could not be sent right now.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyEmailCode() {
    if (loading || verifyCooldown) return
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
      if (verifyError) {
        const seconds = authCooldownSeconds(verifyError)
        if (seconds) {
          setVerifyCooldown(seconds)
          setError(`Too many verification attempts. Please wait ${seconds} seconds.`)
        } else setError('That code was not accepted or has expired.')
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError('The sign-in code could not be verified right now.')
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'password') void signInWithPassword()
    else if (mode === 'code' && codeSent) void verifyEmailCode()
    else void sendSignInEmail()
  }

  return (
    <main className="ops-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <ShieldCheck className="h-10 w-10 text-red-500" />
        <span><strong className="block text-3xl font-black tracking-[-.08em]">ROOF<span className="text-red-500">/OS</span></strong><small className="text-[10px] tracking-[.2em] text-slate-300">STORM COMMAND CENTER</small></span>
      </div>
      <form onSubmit={submit} className="glass w-full max-w-md rounded-2xl p-7">
        <div className="mb-6 flex items-center gap-3"><div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-red-400"><Zap className="h-6 w-6" /></div><div><p className="ops-label">Operator access</p><h1 className="text-2xl font-black">Welcome to ROOF/OS</h1><p className="mt-1 text-sm text-slate-400">Use your password, or get a secure email link.</p></div></div>
        <div className="mb-5 grid grid-cols-3 gap-2">{([['password', 'Password'], ['link', 'Email link'], ['code', '6-digit code']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => changeMode(value)} aria-pressed={mode === value} className={`rounded-lg border py-2 text-xs ${mode === value ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300' : 'border-white/15 text-slate-400'}`}>{label}</button>)}</div>
        <label className="mb-1 block text-sm text-slate-200" htmlFor="email">Work email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); setCodeSent(false); setResetCooldown(0) }} className="mb-4 w-full rounded-lg border border-white/15 bg-black/30 p-3 text-white placeholder:text-slate-500" placeholder="you@company.com" />
        {mode === 'password' && <><label className="mb-1 block text-sm text-slate-200" htmlFor="password">Password</label><input id="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 p-3 text-white placeholder:text-slate-500" placeholder="Enter your password" /><button type="button" onClick={() => void sendPasswordReset()} disabled={loading || resetCooldown > 0} className="mt-2 text-left text-sm text-cyan-300 hover:text-cyan-200 disabled:opacity-60">{resetCooldown ? `Try again in ${resetCooldown}s` : 'Forgot password?'}</button></>}
        {mode === 'code' && codeSent && <><label className="mb-1 mt-4 block text-sm text-slate-200" htmlFor="code">6-digit email code</label><input id="code" type="text" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-lg border border-white/15 bg-black/30 p-3 text-center tracking-[.4em] text-white" placeholder="000000" /> </>}
        {message && <p className="mb-3 mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300" role="status">{message}</p>}
        {error && <p className="mb-3 mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
        <button type="submit" disabled={loading || Boolean(mode === 'code' && codeSent ? verifyCooldown : sendCooldown)} className="mt-4 w-full rounded-lg bg-gradient-to-r from-red-600 to-rose-500 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Authenticating…' : mode === 'password' ? 'Enter command center' : mode === 'code' && codeSent ? 'Verify 6-digit code' : mode === 'code' ? 'Send 6-digit code' : 'Send sign-in link'}</button>
        <button type="button" onClick={() => router.push('/auth/signup')} className="mt-5 w-full text-sm text-slate-400">Create a new workspace</button>
        <p className="mt-6 text-center text-[10px] uppercase tracking-[.16em] text-slate-500">Protected workspace access · Secure session required</p>
      </form>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<main className="ops-shell flex min-h-screen items-center justify-center text-sm text-slate-400">Loading secure access…</main>}><LoginForm /></Suspense>
}
