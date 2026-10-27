'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { authCooldownSeconds } from '../../../lib/auth/cooldown'
import { safeNextPath } from '../../../lib/safe-next'
import DashboardSkinToggle from '../../../components/DashboardSkinToggle'
import { useDashboardSkin } from '../../../components/useDashboardSkin'
import LoginWeatherPreview from '../../../components/LoginWeatherPreview'

const ERROR_COPY: Record<string, string> = {
  enter_locked: 'Break-glass is locked. Set OWNER_ENTER_SECRET on the server (16+ chars).',
  enter_forbidden: 'Wrong or missing break-glass key.',
  enter_misconfigured: 'Server auth is not configured (service role / Supabase URL).',
  enter_no_owner: 'No owner email resolved. Set OWNER_ENTER_EMAIL or system_owner.',
  enter_mint_failed: 'Could not mint owner session. Try again or check service role.',
}

function LoginPageContent() {
  const router = useRouter()
  const stormOn = useDashboardSkin()
  const search = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const next = safeNextPath(search.get('next'), typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin)
  const enterError = search.get('enter_error') || ''
  const resetSuccess = search.get('reset') === 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(resetSuccess ? 'Password updated. Sign in with your new password.' : '')
  const [error, setError] = useState(enterError ? ERROR_COPY[enterError] || 'Owner unlock failed.' : '')
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState<'password' | 'magic' | 'reset' | 'enter' | null>(null)
  const [showBreakGlass, setShowBreakGlass] = useState(false)
  const [key, setKey] = useState('')

  function applyCooldown(authError: { status?: number; code?: string; message?: string } | null) {
    const seconds = authCooldownSeconds(authError)
    if (!seconds) return
    setCooldown(seconds)
    const timer = window.setInterval(() => setCooldown((value) => {
      if (value <= 1) { window.clearInterval(timer); return 0 }
      return value - 1
    }), 1000)
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading('password'); setError(''); setMessage('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) setError('Sign-in failed. Check your email and password, then try again.')
    else router.replace(next)
    setLoading(null)
  }

  async function sendMagicLink() {
    if (cooldown || !email.trim()) { setError('Enter your email first.'); return }
    setLoading('magic'); setError(''); setMessage('')
    const { error: magicError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } })
    if (magicError) { setError('We could not send the sign-in link.'); applyCooldown(magicError) }
    else { setMessage('Check your email for a secure sign-in link.'); setCooldown(60) }
    setLoading(null)
  }

  async function sendReset() {
    if (cooldown || !email.trim()) { setError('Enter your email first.'); return }
    setLoading('reset'); setError(''); setMessage('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/reset')}` })
    if (resetError) { setError('We could not send a reset link.'); applyCooldown(resetError) }
    else { setMessage('If that account exists, a password-reset link is on its way.'); setCooldown(60) }
    setLoading(null)
  }

  function enterOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) return
    setLoading('enter')
    const enter = new URL('/auth/enter', window.location.origin)
    enter.searchParams.set('key', trimmed)
    enter.searchParams.set('next', next)
    router.replace(enter.pathname + enter.search)
    router.refresh()
  }

  return (
    <main className={`ops-bg cinema-surface roof-login-page flex min-h-screen items-center justify-center p-4 ${stormOn ? 'roof-login-storm' : ''}`}>
      <div className={`roof-login-layout relative z-10 w-full max-w-6xl ${stormOn ? 'roof-login-layout-storm' : ''}`}>
        {stormOn && (
          <aside className="roof-login-story" aria-label="Storm Mode introduction">
            <p className="storm-live-indicator inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em]">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> ROOF/OS · STORM COMMAND
            </p>
            <h2 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white md:text-6xl">
              REAL STORMS.<br />REAL DAMAGE.<br /><span className="text-red-500">REAL JOBS.</span>
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-200">
              Official weather intelligence meets inspection, measurement, estimates, and field operations.
              Your records stay real, your workflow stays in control.
            </p>
            <div className="roof-login-weather mt-7">
              <LoginWeatherPreview />
            </div>
          </aside>
        )}
      <section className="roof-login-form glass w-full max-w-md rounded-2xl p-6">
        <div className="mb-5 flex justify-end"><DashboardSkinToggle /></div>
        <div className="mb-5 text-center">
          <div className="mb-2 text-3xl font-black tracking-tight">ROOF<span className="text-red-500">/</span>OS</div>
          <h1 className="text-2xl font-bold">Sign in to ROOF/OS</h1>
          <p className="mt-1 text-sm text-slate-400">Use your work email and password, or request a secure email link.</p>
        </div>
        <form onSubmit={signIn} className="space-y-3">
          <label className="block text-sm font-medium text-slate-200" htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ops-input" placeholder="you@company.com" />
          <label className="block text-sm font-medium text-slate-200" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="ops-input" placeholder="Your password" />
          {message && <p className="text-sm text-emerald-300" role="status">{message}</p>}
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          <button type="submit" disabled={Boolean(loading)} className="ops-btn-primary w-full py-3 disabled:opacity-60">{loading === 'password' ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => void sendMagicLink()} disabled={Boolean(loading) || Boolean(cooldown)} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50">{loading === 'magic' ? 'Sending…' : cooldown ? `Try again in ${cooldown}s` : 'Email link'}</button><button type="button" onClick={() => void sendReset()} disabled={Boolean(loading) || Boolean(cooldown)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 disabled:opacity-50">Forgot password?</button></div>
        <button type="button" onClick={() => router.push(`/auth/signup?next=${encodeURIComponent(next)}`)} className="mt-4 w-full text-sm text-cyan-300">Create a new workspace</button>
        <details open={showBreakGlass} className="mt-6 border-t border-white/10 pt-4" onToggle={(event) => setShowBreakGlass(event.currentTarget.open)}><summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500">ROOF/OS break-glass fallback</summary><p className="mt-2 text-xs text-slate-500">Use this only for private owner recovery. The key is sent to the server and never stored in the browser.</p><form onSubmit={enterOwner} className="mt-3 space-y-3"><label className="block text-xs text-slate-400" htmlFor="owner-enter-key">Owner enter key</label><input id="owner-enter-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} className="ops-input" placeholder="OWNER_ENTER_SECRET" /><button type="submit" disabled={loading === 'enter' || !key.trim()} className="w-full rounded-lg border border-amber-400/30 px-3 py-2 text-sm text-amber-200 disabled:opacity-50">{loading === 'enter' ? 'Entering…' : 'Enter as owner'}</button></form></details>
      </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<main className="min-h-screen flex items-center justify-center p-4 text-sm text-slate-300">Loading sign-in…</main>}><LoginPageContent /></Suspense>
}
