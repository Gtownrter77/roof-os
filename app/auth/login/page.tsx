'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeNextPath } from '../../../lib/safe-next'

const ERROR_COPY: Record<string, string> = {
  enter_locked: 'Break-glass is locked. Set OWNER_ENTER_SECRET on the server (16+ chars).',
  enter_forbidden: 'Wrong or missing break-glass key.',
  enter_misconfigured: 'Server auth is not configured (service role / Supabase URL).',
  enter_no_owner: 'No owner email resolved. Set OWNER_ENTER_EMAIL or system_owner.',
  enter_mint_failed: 'Could not mint owner session. Try again or check service role.',
}

function BreakGlassLogin() {
  const router = useRouter()
  const search = useSearchParams()
  const next = safeNextPath(
    search.get('next'),
    typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin,
  )
  const enterError = search.get('enter_error') || ''
  const errorMessage = useMemo(
    () => (enterError ? ERROR_COPY[enterError] || 'Enter failed. Check the key and try again.' : ''),
    [enterError],
  )
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) return
    setSubmitting(true)
    const enter = new URL('/auth/enter', window.location.origin)
    enter.searchParams.set('key', trimmed)
    enter.searchParams.set('next', next)
    router.replace(enter.pathname + enter.search)
    router.refresh()
  }

  return (
    <main className="cinema-surface min-h-screen flex items-center justify-center p-6 text-white">
      <section className="glass w-full max-w-sm rounded-2xl p-6 shadow-lg">
        <h1 className="text-xl font-bold text-center">ROOF/OS break-glass</h1>
        <p className="mt-2 text-sm text-slate-300 text-center">
          Private unlock. Paste your owner enter key. Strangers without it stay out.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-left text-xs uppercase tracking-wide text-slate-400">
            Owner enter key
            <input
              type="password"
              name="key"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              placeholder="OWNER_ENTER_SECRET"
              required
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !key.trim()}
            className="w-full rounded-lg bg-cyan-500 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {submitting ? 'Entering…' : 'Enter as owner'}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500 text-center">
          Or bookmark <code className="text-slate-400">/auth/enter?key=…</code> for one-tap unlock.
        </p>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="cinema-surface min-h-screen text-white flex items-center justify-center">
          Loading…
        </main>
      }
    >
      <BreakGlassLogin />
    </Suspense>
  )
}
