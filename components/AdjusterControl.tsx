'use client'

import { useCallback, useEffect, useState } from 'react'

// Folded into the existing workspace agent settings — not a separate app,
// worker or sixteenth agent. The stop control calls the real cancel RPC route.

type Claim = {
  id: string
  lead_id: string | null
  status: string
  disabled: boolean
  identity_id: string
  created_at: string
}

export default function AdjusterControl() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/jarvis/claims', { cache: 'no-store' })
      const payload = await response.json() as { claims?: Claim[]; error?: string }
      if (!response.ok) { setMessage(payload.error ?? 'Could not load adjuster claims.'); return }
      setClaims(payload.claims ?? [])
    } catch {
      setMessage('Could not load adjuster claims.')
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
      const payload = await response.json() as { error?: string }
      if (!response.ok) { setMessage(payload.error ?? 'Stop control failed.'); return }
      setClaims((current) => current.map((item) => item.id === claim.id ? { ...item, disabled: true, status: 'cancelled' } : item))
      setMessage(`${claim.lead_id ?? 'Claim'} stopped. Queued work was cancelled.`)
    } catch {
      setMessage('Stop control failed because the network request failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="glass rounded-xl p-4 border-l-4 border-sky-500 space-y-3" aria-labelledby="adjuster-control-title">
      <h2 id="adjuster-control-title" className="font-bold text-sm text-white">JARVIS · autonomous adjuster</h2>
      <p className="text-xs text-slate-400">
        Claims run on the existing JARVIS queue. Plan only until execution is explicitly authorized. Every message is consent-gated and recorded in the adjuster thread.
      </p>
      {message && <p className="text-xs text-amber-200" role="status">{message}</p>}
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
