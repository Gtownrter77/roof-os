'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '../../../lib/supabase/client'

type TrialResult = {
  workspace_id: string
  started_at: string
  expires_at: string
  already_active: boolean
}

export default function TrialActivationPage() {
  const [companyDomain, setCompanyDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trial, setTrial] = useState<TrialResult | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (active && typeof data.user?.user_metadata?.trial_company_domain === 'string') {
        setCompanyDomain(data.user.user_metadata.trial_company_domain)
      }
    })
    return () => { active = false }
  }, [])

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/trials/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ companyDomain }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Trial activation failed.')
      setTrial(body.trial as TrialResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trial activation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ops-bg flex min-h-screen items-center justify-center p-4">
      <section className="glass w-full max-w-md rounded-2xl p-6">
        <div className="mb-3 text-center text-4xl">⏱️</div>
        <h1 className="text-center text-xl font-bold">Activate your ROOF/OS trial</h1>
        <p className="mb-6 mt-2 text-center text-sm text-slate-400">
          Your two-hour trial starts when you press Activate. Use a verified work email and its matching company domain.
        </p>
        {trial ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4" role="status">
            <h2 className="font-semibold text-emerald-200">Trial activated</h2>
            <p className="mt-2 text-sm text-slate-200">Your access ends at:</p>
            <p className="mt-1 break-all font-mono text-sm">{new Date(trial.expires_at).toLocaleString()}</p>
            <p className="mt-3 text-xs text-slate-400">The cutoff is enforced by the server, not your device clock. Existing customer workspaces are not changed.</p>
            <a className="ops-btn-primary mt-4 block w-full py-3 text-center" href="/">Open ROOF/OS</a>
          </div>
        ) : (
          <form onSubmit={activate}>
            <label className="mb-1 block text-sm font-medium text-slate-200" htmlFor="company-domain">Company email domain</label>
            <input id="company-domain" type="text" required maxLength={253} value={companyDomain} onChange={(event) => setCompanyDomain(event.target.value)} className="ops-input mb-4" placeholder="yourcompany.com" autoComplete="organization" />
            {error && <p className="mb-3 text-sm text-red-300" role="alert">{error}</p>}
            <button type="submit" disabled={loading} className="ops-btn-primary w-full py-3 disabled:opacity-60">
              {loading ? 'Activating…' : 'Start my 2-hour trial'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
