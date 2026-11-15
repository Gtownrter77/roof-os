'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BAILEY_AGENT_CATALOG,
  defaultBaileyAgentSetup,
  type BaileyAgentKey,
  type BaileyAgentPreference,
  type BaileyAgentSetup,
  type BaileyAgentSetupStatus,
} from '../../../lib/bailey-agent-onboarding'

const MODES: Array<{ value: BaileyAgentPreference; label: string; explanation: string }> = [
  { value: 'off', label: 'Off', explanation: 'No future use requested.' },
  { value: 'review_only', label: 'Review only', explanation: 'Plan to receive drafts and recommendations.' },
  { value: 'approval_required', label: 'Approval required', explanation: 'Plan to require an explicit approval for any future external action.' },
]

export default function BaileyAgentOnboardingPage() {
  const [setup, setSetup] = useState<BaileyAgentSetup>(defaultBaileyAgentSetup)
  const [savedSetup, setSavedSetup] = useState<BaileyAgentSetup>(defaultBaileyAgentSetup)
  const [status, setStatus] = useState<BaileyAgentSetupStatus>('draft')
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const current = BAILEY_AGENT_CATALOG[index]
  const dirty = JSON.stringify(setup) !== JSON.stringify(savedSetup)
  const reviewedCount = Object.values(setup).filter((mode) => mode !== 'off').length

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/onboarding/agents', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not load BAILEY agent setup.')
        if (!active) return
        const loaded = payload.setup as BaileyAgentSetup
        setSetup(loaded)
        setSavedSetup(loaded)
        setStatus(payload.status === 'reviewed' ? 'reviewed' : 'draft')
        setCanEdit(payload.canEdit === true)
        setUpdatedAt(typeof payload.updatedAt === 'string' ? payload.updatedAt : null)
      } catch (cause) {
        if (active) {
          setLoadFailed(true)
          setError(cause instanceof Error ? cause.message : 'Could not load agent setup.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  function setMode(key: BaileyAgentKey, mode: BaileyAgentPreference) {
    setSetup((currentSetup) => ({ ...currentSetup, [key]: mode }))
    setReviewConfirmed(false)
    setNotice('')
  }

  async function save(nextStatus: BaileyAgentSetupStatus) {
    if (!canEdit || saving) return
    if (nextStatus === 'reviewed' && !reviewConfirmed) {
      setError('Confirm you have reviewed the safety notice before marking your choices reviewed.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/onboarding/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup, status: nextStatus }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save agent setup.')
      setSavedSetup(payload.setup as BaileyAgentSetup)
      setSetup(payload.setup as BaileyAgentSetup)
      setStatus(payload.status === 'reviewed' ? 'reviewed' : 'draft')
      setUpdatedAt(payload.updated_at ?? null)
      setNotice(nextStatus === 'reviewed'
        ? 'Preferences reviewed and saved. No agents were activated.'
        : 'Draft saved. No agents were activated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save agent setup.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <Link href="/onboarding/workspace" className="text-sm text-cyan-300 underline underline-offset-4">Back to company setup</Link>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">BAILEY BOSS · Setup</p>
          <h1 className="text-3xl font-bold">Configure your 15 AI agents</h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Set your preferences one agent at a time. These are planning preferences only. They do not install,
            enable, grant permissions to, or prove that any agent works.
          </p>
        </header>

        <section role="note" className="rounded-xl border border-amber-300/40 bg-amber-950/30 p-4 text-sm text-amber-100">
          <strong>Safety boundary:</strong> Saving or reviewing this wizard never authorizes phone calls, texts, emails,
          purchases, changes to production systems, access to private data, or agent execution.
          Actual actions require separately implemented permissions, operational readiness, and approval checks.
        </section>

        {loading ? <p role="status">Loading agent setup…</p> : loadFailed ? (
          <section role="alert" className="rounded-xl border border-red-300/40 p-4">
            <p>{error}</p>
            <button className="mt-3 rounded border px-3 py-2" onClick={() => window.location.reload()}>Try again</button>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-300">
              <span>Agent {index + 1} of {BAILEY_AGENT_CATALOG.length} · {reviewedCount} preferences other than Off</span>
              <span>{status === 'reviewed' && !dirty ? 'Preferences reviewed' : 'Draft / unsaved changes possible'}</span>
              {updatedAt && <span>Last saved: {new Date(updatedAt).toLocaleString()}</span>}
            </div>
            <div role="progressbar" aria-label="Agent setup progress" aria-valuemin={1} aria-valuemax={15} aria-valuenow={index + 1} className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-cyan-500 motion-safe:transition-all" style={{ width: `${((index + 1) / 15) * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {BAILEY_AGENT_CATALOG.map((agent, itemIndex) => (
                <button key={agent.key} type="button" onClick={() => setIndex(itemIndex)}
                  aria-label={`Go to agent ${itemIndex + 1}: ${agent.label}`}
                  aria-current={index === itemIndex ? 'step' : undefined}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${index === itemIndex ? 'border-cyan-300 bg-cyan-950 text-white' : 'border-slate-700 text-slate-300'}`}>
                  {String(itemIndex + 1).padStart(2, '0')}
                </button>
              ))}
            </div>
            <section className="rounded-2xl border border-white/15 bg-slate-900/80 p-5">
              <p className="text-xs uppercase tracking-wider text-cyan-300">Agent {index + 1}</p>
              <h2 className="mt-1 text-xl font-bold">{current.label}</h2>
              <p className="mt-2 text-sm text-slate-300">{current.description}</p>
              <fieldset className="mt-6 space-y-3" disabled={!canEdit || saving}>
                <legend className="mb-2 text-sm font-semibold">Initial preference</legend>
                {MODES.map((mode) => (
                  <label key={mode.value} className="flex cursor-pointer gap-3 rounded-xl border border-white/15 p-3">
                    <input type="radio" name={`mode-${current.key}`} value={mode.value}
                      checked={setup[current.key] === mode.value}
                      onChange={() => setMode(current.key, mode.value)} />
                    <span>
                      <span className="block text-sm font-semibold">{mode.label}</span>
                      <span className="block text-xs text-slate-400">{mode.explanation}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {!canEdit && <p className="mt-3 text-sm text-amber-200">Only workspace administrators can change these preferences.</p>}
              <nav aria-label="Agent steps" className="mt-6 flex justify-between gap-3">
                <button type="button" onClick={() => setIndex((n) => Math.max(0, n - 1))} disabled={index === 0} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-30">Previous</button>
                <button type="button" onClick={() => setIndex((n) => Math.min(14, n + 1))} disabled={index === 14} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm disabled:opacity-30">Next agent</button>
              </nav>
            </section>

            <section className="rounded-xl border border-white/15 p-4">
              <h2 className="font-semibold">Review and save</h2>
              <p className="mt-1 text-xs text-slate-400">
                All 15 agents default to Off. Even “Approval required” is only a requested future mode—not an approval or permission grant.
              </p>
              <label className="mt-4 flex items-start gap-3 text-sm">
                <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} disabled={!canEdit || saving} />
                <span>I understand that reviewing these preferences does not activate any agent or authorize any external action.</span>
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void save('draft')} disabled={!canEdit || saving || (!dirty && status === 'draft')}
                  className="rounded-lg border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" onClick={() => void save('reviewed')} disabled={!canEdit || saving || !reviewConfirmed}
                  className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold disabled:opacity-40">
                  Mark preferences reviewed
                </button>
              </div>
              {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
              {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
