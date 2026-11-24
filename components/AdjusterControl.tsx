'use client'

import { useCallback, useEffect, useState } from 'react'
import { readApiJson } from '../lib/client/safe-fetch'

// Folded into the existing workspace agent settings — not a separate app,
// worker or sixteenth agent. Both stop controls call the real cancel RPC routes.

type Claim = {
  id: string
  lead_id: string | null
  status: string
  disabled: boolean
  identity_id: string
  created_at: string
}

type Settings = { adjusterEnabled: boolean | null; planOnly: boolean | null; identityId: string }

export default function AdjusterControl() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [claimsResponse, settingsResponse] = await Promise.all([
        fetch('/api/jarvis/claims', { cache: 'no-store' }),
        fetch('/api/jarvis/settings', { cache: 'no-store' }),
      ])
      const parsedClaims = await readApiJson<{ claims?: Claim[] }>(claimsResponse)
      const parsedSettings = await readApiJson<Settings>(settingsResponse)
      if (!parsedClaims.ok) { setMessage(parsedClaims.error); return }
      if (!parsedSettings.ok) { setMessage(parsedSettings.error); return }
      setClaims(parsedClaims.data.claims ?? [])
      setSettings(parsedSettings.data)
    } catch {
      setMessage('Could not load adjuster controls.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const stop = async (claim: Claim) => {
    setBusy(claim.id)
    setMessage('')
    try {
      const response = await fetch(`/api/jarvis/claims/${claim.id}/disable`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ disabled: true }),
      })
      const parsed = await readApiJson<Record<string, unknown>>(response)
      if (!parsed.ok) { setMessage(parsed.error); return }
      setClaims((current) => current.map((item) => item.id === claim.id ? { ...item, disabled: true, status: 'cancelled' } : item))
      setMessage(`${claim.lead_id ?? 'Claim'} stopped. Queued work was cancelled.`)
    } catch {
      setMessage('Stop control failed because the network request failed.')
    } finally {
      setBusy(null)
    }
  }

  const toggleWorkspace = async () => {
    if (!settings || settings.adjusterEnabled === null) return
    setBusy('workspace')
    setMessage('')
    try {
      const enabled = !settings.adjusterEnabled
      const response = await fetch('/api/jarvis/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const parsed = await readApiJson<{ enabled?: boolean }>(response)
      if (!parsed.ok) { setMessage(parsed.error); return }
      setSettings((current) => current ? { ...current, adjusterEnabled: enabled } : current)
      setMessage(enabled ? 'Adjuster restarted. New claims may be queued.' : 'Adjuster stopped for this workspace. Queued work was cancelled.')
      void load()
    } catch {
      setMessage('Workspace stop control failed because the network request failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="glass rounded-xl p-4 border-l-4 border-sky-500 space-y-3" aria-labelledby="adjuster-control-title">
      <h2 id="adjuster-control-title" className="font-bold text-sm text-white">JARVIS · autonomous adjuster</h2>
      <p className="text-xs text-slate-400">
        Claims run on the existing JARVIS queue. Plan only until execution is explicitly authorized. Every send is checked against consent, contact window and provenance before it is recorded in the adjuster thread.
      </p>
      {message && <p className="text-xs text-amber-200" role="status">{message}</p>}
      {settings?.adjusterEnabled !== null && settings && (
        <button
          type="button"
          onClick={() => void toggleWorkspace()}
          disabled={busy === 'workspace'}
          className="rounded border border-amber-400/40 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
        >
          {busy === 'workspace' ? 'Updating…' : settings.adjusterEnabled ? 'Stop adjuster for workspace' : 'Restart adjuster'}
        </button>
      )}
      {claims.length === 0 ? (
        <p className="text-xs text-slate-400">No enrolled claims yet. Claims enroll automatically unless disabled.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {claims.map((claim) => (
            <li key={claim.id} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-white/5 p-2">
              <span className="min-w-0 truncate text-slate-200">{claim.lead_id ?? claim.id} · {claim.status}{claim.disabled ? ' · stopped' : ''}</span>
              {!claim.disabled && (
                <button
                  type="button"
                  onClick={() => void stop(claim)}
                  disabled={busy === claim.id}
                  className="shrink-0 rounded border border-red-400/40 px-2 py-1 font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {busy === claim.id ? 'Stopping…' : 'Stop claim'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
