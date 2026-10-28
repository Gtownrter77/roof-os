'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../../lib/smart-back'
import { buildReviewExportFile } from '../../../lib/agent5/export'
import type { ReviewPacket } from '../../../lib/agent5/types'

type DraftSummary = {
  id: string
  document_id: string
  revision: number
  status: string
  created_at: string
  approved_at: string | null
  line_count: number
  proposal_count: number
  carrier_source_total: number | null
  contractor_total: number | null
  delta: number | null
  export_blocked: boolean
}

type Proposal = {
  kind: string
  description: string
  carrier_evidence: string[] | null
  contractor_evidence: string[] | null
  quantity_delta: number | null
  amount_delta: number | null
  requires_human_review: boolean
}

type Line = {
  description: string
  item_code: string | null
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  provenance: string
}

type Packet = {
  status?: string
  lines?: Line[]
  proposals?: Proposal[]
  totals?: {
    carrier_source_total?: number | null
    contractor_total?: number | null
    delta?: number | null
  }
  uncertainty?: Record<string, number>
  excluded?: Record<string, number>
  export_blocked?: boolean
  note?: string
}

type Draft = {
  id: string
  document_id: string
  revision: number
  status: string
  packet: Packet
  created_at: string
  approved_at: string | null
}

const money = (value: number | null | undefined) =>
  typeof value === 'number' ? `$${value.toFixed(2)}` : 'unknown'

const kindTone: Record<string, string> = {
  missing_scope: 'border-amber-500/60 text-amber-200',
  quantity_delta: 'border-cyan-500/60 text-cyan-200',
  trade_mismatch: 'border-fuchsia-500/60 text-fuchsia-200',
  code_mismatch: 'border-orange-500/60 text-orange-200',
  unsupported_line: 'border-slate-500/60 text-slate-300',
  question: 'border-blue-500/60 text-blue-200',
}

export default function SupplementReviewPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [canApprove, setCanApprove] = useState(false)
  const [selected, setSelected] = useState<Draft | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/supplements/review', { signal, cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (signal?.aborted) return
      if (!response.ok) {
        setMessage(result.error ?? 'Could not load supplement review drafts.')
        return
      }
      setDrafts(result.drafts ?? [])
      setCanApprove(result.can_approve === true)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('Could not load supplement review drafts because the network request failed.')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadList(controller.signal)
    return () => controller.abort()
  }, [loadList])

  const openDraft = async (id: string) => {
    try {
      const response = await fetch(`/api/supplements/review/${id}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'Could not load the draft.')
        return
      }
      setSelected(result.draft as Draft)
      setCanApprove(result.can_approve === true)
    } catch {
      setMessage('Could not load the draft because the network request failed.')
    }
  }

  const downloadReviewCopy = (format: 'json' | 'csv') => {
    if (!selected) return
    const file = buildReviewExportFile(selected.packet as unknown as ReviewPacket, format)
    const url = URL.createObjectURL(new Blob([file.content], { type: file.content_type }))
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Downloaded an internal review copy. It is not an insurer file and nothing was sent.')
  }

  const review = async (status: 'approved' | 'rejected') => {    if (!selected) return
    setBusy(true)
    setMessage(status === 'approved' ? 'Recording owner approval…' : 'Recording rejection…')
    try {
      const response = await fetch(`/api/supplements/review/${selected.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'Could not update the review.')
        return
      }
      setMessage(
        status === 'approved'
          ? 'Approved. Nothing was submitted to an insurer or exported.'
          : 'Rejected. Nothing was submitted or exported.',
      )
      await loadList()
      await openDraft(selected.id)
    } catch {
      setMessage('Could not update the review because the network request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => smartBack(router)} className="text-xl text-cyan-300" aria-label="Back">←</button>
          <h1 className="text-xl font-bold">📋 Supplement review</h1>
          <span className="ml-auto text-xs text-slate-400">Owner / admin only to approve</span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <p className="text-xs text-slate-400">
          Agent 5 packets are review-only. Approval records a human decision. It does not contact an insurer,
          submit a claim, export ESX, or change a carrier file.
        </p>
        {message && <p className="text-sm text-cyan-300" role="status">{message}</p>}

        <section className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Drafts</h2>
            <button onClick={() => void loadList()} className="text-xs text-cyan-300">Refresh</button>
          </div>
          {drafts.length === 0 && <p className="text-sm text-slate-400">No supplement review drafts are visible in this workspace.</p>}
          <div className="space-y-2">
            {drafts.map((draft) => (
              <button
                key={draft.id}
                onClick={() => { setMessage(''); void openDraft(draft.id) }}
                className={`w-full text-left border rounded-lg p-3 hover:border-cyan-500 ${selected?.id === draft.id ? 'border-cyan-500' : 'border-white/10'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{draft.document_id}</span>
                  <span className="text-xs text-slate-400">rev {draft.revision} · {draft.status.replaceAll('_', ' ')}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {draft.line_count} line(s) · {draft.proposal_count} proposal(s) · carrier {money(draft.carrier_source_total)} · contractor {money(draft.contractor_total)} · delta {money(draft.delta)}
                </p>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <section className="glass rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{selected.document_id}</h2>
                <p className="text-xs text-slate-400">revision {selected.revision} · {selected.status.replaceAll('_', ' ')} · {new Date(selected.created_at).toLocaleString()}</p>
              </div>
              {canApprove && selected.status === 'ready_for_review' ? (
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => void review('approved')}
                    className="bg-green-600 text-white text-xs px-3 py-2 rounded disabled:opacity-50"
                  >
                    Approve as owner
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void review('rejected')}
                    className="bg-red-600 text-white text-xs px-3 py-2 rounded disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  {canApprove ? 'This draft is no longer open for review.' : 'Read-only: workspace owner or admin approval is required.'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => downloadReviewCopy('json')}
                className="border border-cyan-500/60 text-cyan-200 text-xs px-3 py-2 rounded"
              >
                Download review JSON
              </button>
              <button
                onClick={() => downloadReviewCopy('csv')}
                className="border border-cyan-500/60 text-cyan-200 text-xs px-3 py-2 rounded"
              >
                Download review CSV
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Internal review copy only. The file is not an ESX structure and is never sent to an insurer.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="border border-white/10 rounded-lg p-2"><p className="text-xs text-slate-400">Carrier total</p><p>{money(selected.packet.totals?.carrier_source_total)}</p></div>
              <div className="border border-white/10 rounded-lg p-2"><p className="text-xs text-slate-400">Contractor total</p><p>{money(selected.packet.totals?.contractor_total)}</p></div>
              <div className="border border-white/10 rounded-lg p-2"><p className="text-xs text-slate-400">Delta</p><p>{money(selected.packet.totals?.delta)}</p></div>
              <div className="border border-white/10 rounded-lg p-2"><p className="text-xs text-slate-400">Export</p><p>{selected.packet.export_blocked === true ? 'blocked' : 'unknown'}</p></div>
            </div>

            {selected.packet.uncertainty && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Uncertainty</h3>
                <p className="text-xs text-slate-400">
                  {Object.entries(selected.packet.uncertainty).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ')}
                </p>
              </div>
            )}
            {selected.packet.excluded && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Excluded from totals and deltas</h3>
                <p className="text-xs text-slate-400">
                  {Object.entries(selected.packet.excluded).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ')}
                </p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">Proposals ({selected.packet.proposals?.length ?? 0})</h3>
              {(selected.packet.proposals?.length ?? 0) === 0 && <p className="text-xs text-slate-400">No proposals.</p>}
              <div className="space-y-2">
                {(selected.packet.proposals ?? []).map((proposal, index) => (
                  <article key={`${proposal.kind}-${index}`} className={`border rounded-lg p-3 ${kindTone[proposal.kind] ?? 'border-white/10 text-slate-200'}`}>
                    <p className="text-xs uppercase tracking-wide">{proposal.kind.replaceAll('_', ' ')}</p>
                    <p className="text-sm mt-1">{proposal.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      quantity delta {proposal.quantity_delta ?? 'n/a'} · amount delta {money(proposal.amount_delta)} · human review {proposal.requires_human_review ? 'required' : 'not required'}
                    </p>
                    {proposal.carrier_evidence && (
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap mt-2">Carrier: {proposal.carrier_evidence.join(' | ')}</pre>
                    )}
                    {proposal.contractor_evidence && (
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap mt-1">Contractor: {proposal.contractor_evidence.join(' | ')}</pre>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Carrier lines ({selected.packet.lines?.length ?? 0})</h3>
              <div className="space-y-1">
                {(selected.packet.lines ?? []).slice(0, 50).map((line, index) => (
                  <p key={index} className="text-xs text-slate-300">
                    {line.item_code ? `${line.item_code} · ` : ''}{line.description} · {line.quantity ?? '?'} {line.unit ?? ''} · {money(line.unit_cost)} · {line.provenance}
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
