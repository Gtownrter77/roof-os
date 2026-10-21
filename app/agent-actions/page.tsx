'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

type Action = {
  id: string
  batch_id: string
  sequence: number
  kind: string
  subject_type: string
  subject_id: string | null
  payload: Record<string, unknown>
  reason: string
  risk_level: string
  status: string
  requires_approval: boolean
  payload_hash: string
}
type Batch = {
  id: string
  batch_key: string
  status: string
  risk_level: string
  summary: string
  expires_at: string | null
  created_at: string
  actions: Action[]
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
}
async function sha256(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
function label(value: string) { return value.replaceAll('_', ' ') }
function riskClass(value: string) {
  if (value === 'financial' || value === 'legal') return 'border-rose-400/40 bg-rose-400/10 text-rose-200'
  if (value === 'customer_communication' || value === 'operational') return 'border-amber-400/40 bg-amber-400/10 text-amber-200'
  return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
}

export default function AgentActionsPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/agent-actions', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not load agent actions.')
      setBatches(payload.batches ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load agent actions.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const totalActions = useMemo(() => batches.reduce((count, batch) => count + batch.actions.length, 0), [batches])
  const approve = async (batch: Batch) => {
    if (busy) return
    setBusy(batch.id); setError(''); setMessage('')
    try {
      const actionIds = batch.actions.map((action) => action.id)
      const approvalSummaryHash = await sha256({ batchId: batch.id, summary: batch.summary, actionIds })
      const approvedPayloadHash = await sha256(batch.actions.map((action) => ({ id: action.id, payloadHash: action.payload_hash })))
      const response = await fetch('/api/agent-actions/approve', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ batchId: batch.id, actionIds, approvalSummaryHash, approvedPayloadHash }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not approve this batch.')
      setMessage(`Authorized ${batch.actions.length} action${batch.actions.length === 1 ? '' : 's'}. The worker will execute the approved actions.`)
      await load()
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : 'Could not approve this batch.')
    } finally { setBusy(null) }
  }

  return <main className="space-y-4 pb-20"><div className="mx-auto max-w-[1180px] p-4 pb-16 md:p-6">
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><button onClick={() => smartBack(router)} className="mb-2 text-xs text-cyan-300">← Back</button><p className="ops-label">Agent control plane</p><h1 className="text-3xl font-black">Approval inbox</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Agents prepare work. You authorize exact action bundles once. Nothing customer-facing or financial runs from a changed payload.</p></div>
      <div className="glass rounded-lg px-3 py-2 text-xs text-cyan-200">{loading ? 'Syncing…' : `${batches.length} bundle${batches.length === 1 ? '' : 's'} · ${totalActions} action${totalActions === 1 ? '' : 's'}`}</div>
    </header>
    {message && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200" role="status">{message}</p>}
    {error && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">{error}</p>}
    {loading && <div className="glass rounded-xl p-6 text-sm text-slate-400">Loading agent proposals…</div>}
    {!loading && batches.length === 0 && <section className="glass rounded-xl p-8 text-center"><p className="text-lg font-bold text-white">No action bundles are waiting.</p><p className="mt-2 text-sm text-slate-400">When the agents find work that needs authorization, it will appear here as one reviewable bundle.</p></section>}
    <div className="space-y-4">{batches.map((batch) => <article key={batch.id} className="glass rounded-2xl border border-white/10 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${riskClass(batch.risk_level)}`}>{label(batch.risk_level)}</span><span className="text-xs text-slate-500">{new Date(batch.created_at).toLocaleString()}</span></div><h2 className="mt-3 text-lg font-bold text-white">{batch.summary}</h2><p className="mt-1 text-xs text-slate-500">Batch {batch.batch_key}{batch.expires_at ? ` · expires ${new Date(batch.expires_at).toLocaleString()}` : ''}</p></div><button onClick={() => void approve(batch)} disabled={Boolean(busy)} className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60">{busy === batch.id ? 'Authorizing…' : `Authorize ${batch.actions.length} action${batch.actions.length === 1 ? '' : 's'}`}</button></div>
      <div className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10 bg-black/15">{batch.actions.map((action) => <div key={action.id} className="flex flex-wrap items-start justify-between gap-3 p-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">{label(action.kind)}</p><p className="mt-1 text-xs text-slate-400">{action.reason}</p><p className="mt-1 break-all text-[10px] text-slate-600">{action.subject_type}{action.subject_id ? ` · ${action.subject_id}` : ''}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${riskClass(action.risk_level)}`}>{label(action.risk_level)}</span></div>)}</div>
    </article>)}</div>
  </div></main>
}
