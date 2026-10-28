'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { describeAcceptanceMethod, type DepositState } from '../../../lib/estimates/acceptance'
import { describeProductionJobStatus, describeScopeLineCount } from '../../../lib/jobs/production'

type LineItem = {
  id: string
  item_code: string
  description: string
  category: string
  unit: string
  quantity: number
  unit_cost: number
  line_total: number
}

type Acceptance = {
  id: string
  accepted_by_name: string
  acceptance_method: string
  note: string | null
  accepted_subtotal: number
  accepted_tax: number
  accepted_total: number
  estimate_formula_version: string
  accepted_at: string
}

type DepositEventRow = {
  id: string
  event_type: 'requested' | 'received' | 'waived' | 'refunded'
  amount: number
  method: string | null
  reference: string | null
  note: string | null
  occurred_at: string
}

type AcceptancePayload = {
  acceptance: Acceptance | null
  deposits: DepositEventRow[]
  depositState: DepositState
  disclaimer: string
}

type ApprovedScopeLine = {
  line_item_id: string
  item_code: string
  description: string
  category: string
  unit: string
  quantity: number
  unit_cost: number
  line_total: number
}

type ProductionJob = {
  id: string
  job_number: string
  status: string
  customer_name: string
  property_address: string
  accepted_total: number
  accepted_at: string
  estimate_formula_version: string
  approved_scope: ApprovedScopeLine[]
  scope_item_count: number
  created_at: string
}

type JobPayload = {
  job: ProductionJob | null
  acceptance: { id: string; accepted_total: number; accepted_at: string } | null
  can_handoff: boolean
}

type Estimate = {
  id: string
  status: string
  subtotal: number
  tax: number
  total: number
  created_at: string
  estimate_snapshot?: {
    customer?: { name?: string; email?: string; phone?: string }
    property?: { address?: string; city?: string; state?: string; zip?: string }
    notes?: { customer?: string; internal?: string }
  }
  line_items?: LineItem[]
}

const money = (amount: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount ?? 0))

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null)
  const [deposits, setDeposits] = useState<DepositEventRow[]>([])
  const [depositState, setDepositState] = useState<DepositState | null>(null)
  const [disclaimer, setDisclaimer] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [acceptanceMethod, setAcceptanceMethod] = useState('phone')
  const [acceptanceNote, setAcceptanceNote] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('check')
  const [depositReference, setDepositReference] = useState('')
  const [depositNote, setDepositNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [job, setJob] = useState<ProductionJob | null>(null)
  const [canHandoff, setCanHandoff] = useState(false)
  const [jobError, setJobError] = useState('')
  const [creatingJob, setCreatingJob] = useState(false)

  const loadJob = useCallback(async () => {
    const response = await fetch('/api/estimates/' + encodeURIComponent(id) + '/job', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Could not load the production job.')
    const payload = data as JobPayload
    setJob(payload.job ?? null)
    setCanHandoff(Boolean(payload.can_handoff))
  }, [id])

  const loadAcceptance = useCallback(async () => {
    const response = await fetch('/api/estimates/' + encodeURIComponent(id) + '/acceptance', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Could not load the recorded acceptance.')
    const payload = data as AcceptancePayload
    setAcceptance(payload.acceptance)
    setDeposits(payload.deposits ?? [])
    setDepositState(payload.depositState ?? null)
    setDisclaimer(payload.disclaimer ?? '')
  }, [id])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetch('/api/estimates/' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.estimate) throw new Error(data.error || 'Could not load estimate.')
        setEstimate(data.estimate)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load estimate.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    loadAcceptance().catch((cause: unknown) => {
      if (!controller.signal.aborted) setRecordError(cause instanceof Error ? cause.message : 'Could not load the recorded acceptance.')
    })
    loadJob().catch((cause: unknown) => {
      if (!controller.signal.aborted) setJobError(cause instanceof Error ? cause.message : 'Could not load the production job.')
    })
    return () => controller.abort()
  }, [id, loadAcceptance, loadJob])

  async function post(body: Record<string, unknown>) {
    setSaving(true)
    setRecordError('')
    try {
      const response = await fetch('/api/estimates/' + encodeURIComponent(id) + '/acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save the record.')
      const payload = data as AcceptancePayload
      setAcceptance(payload.acceptance)
      setDeposits(payload.deposits ?? [])
      setDepositState(payload.depositState ?? null)
      setDisclaimer(payload.disclaimer ?? '')
      setCustomerName('')
      setAcceptanceNote('')
      setDepositAmount('')
      setDepositReference('')
      setDepositNote('')
      await loadJob().catch(() => undefined)
    } catch (cause) {
      setRecordError(cause instanceof Error ? cause.message : 'Could not save the record.')
    } finally {
      setSaving(false)
    }
  }

  async function createJob() {
    setCreatingJob(true)
    setJobError('')
    try {
      const response = await fetch('/api/estimates/' + encodeURIComponent(id) + '/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_job' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not create the production job.')
      const payload = data as JobPayload
      setJob(payload.job ?? null)
      setCanHandoff(Boolean(payload.can_handoff))
    } catch (cause) {
      setJobError(cause instanceof Error ? cause.message : 'Could not create the production job.')
    } finally {
      setCreatingJob(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/estimate" className="text-cyan-300 text-sm hover:underline">← All estimates</Link>
            <h1 className="mt-2 text-2xl font-bold">Estimate details</h1>
          </div>
          {estimate && (estimate.status === 'draft' || estimate.status === 'pending_approval') && (
            <Link href={'/estimate/' + encodeURIComponent(estimate.id) + '/edit'} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">
              Edit estimate
            </Link>
          )}
        </header>
        {loading && <p role="status">Loading estimate…</p>}
        {error && <p role="alert" className="rounded border border-red-500 p-3 text-red-200">{error}</p>}
        {!loading && estimate && (
          <>
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5 space-y-3">
              <div className="flex justify-between gap-4">
                <p className="font-semibold">Status: {estimate.status.replaceAll('_', ' ')}</p>
                <p className="text-sm text-slate-400">Created {new Date(estimate.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-xl font-bold">{estimate.estimate_snapshot?.customer?.name || 'Customer not assigned'}</p>
              <p className="text-slate-300">{estimate.estimate_snapshot?.property?.address || 'Property address not provided'}</p>
              <p className="text-sm text-slate-400">{estimate.estimate_snapshot?.customer?.email || ''}</p>
            </section>
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <h2 className="font-semibold mb-4">Estimate line items</h2>
              {(estimate.line_items || []).length === 0 ? (
                <p className="text-slate-400">No line items saved. This estimate is not ready for approval.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/15 text-left text-slate-300"><th className="py-2">Description</th><th>Qty</th><th>Unit</th><th>Unit cost</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {estimate.line_items.map((item) => (
                        <tr key={item.id} className="border-b border-white/10">
                          <td className="py-3 pr-3">{item.description}</td>
                          <td>{item.quantity}</td><td>{item.unit}</td><td>{money(item.unit_cost)}</td>
                          <td className="text-right">{money(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <dl className="mt-5 ml-auto max-w-xs space-y-2 border-t border-white/10 pt-4">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(estimate.subtotal)}</dd></div>
                <div className="flex justify-between"><dt>Tax</dt><dd>{money(estimate.tax)}</dd></div>
                <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{money(estimate.total)}</dd></div>
              </dl>
            </section>
            {estimate.estimate_snapshot?.notes?.customer && (
              <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <h2 className="font-semibold mb-2">Customer notes</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-300">{estimate.estimate_snapshot.notes.customer}</p>
              </section>
            )}
            {estimate.status === 'approved' && (
              <section className="rounded-xl border border-white/10 bg-slate-900 p-5 space-y-4">
                <div>
                  <h2 className="font-semibold">Customer acceptance</h2>
                  <p className="mt-1 text-xs text-amber-200">
                    {disclaimer || 'This records what the customer told office staff. It is not an electronic signature.'}
                  </p>
                </div>
                {recordError && <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-200">{recordError}</p>}

                {!acceptance ? (
                  <div className="space-y-3">
                    <label className="block text-sm">
                      <span className="text-slate-300">Customer name</span>
                      <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={120} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" placeholder="Name of the person who accepted" />
                    </label>
                    <label className="block text-sm">
                      <span className="text-slate-300">How did they accept?</span>
                      <select value={acceptanceMethod} onChange={(event) => setAcceptanceMethod(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                        <option value="in_person">In person</option>
                        <option value="phone">Phone</option>
                        <option value="email">Email</option>
                        <option value="text">Text message</option>
                        <option value="portal">Customer portal</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="text-slate-300">Note (optional)</span>
                      <textarea value={acceptanceNote} onChange={(event) => setAcceptanceNote(event.target.value)} maxLength={2000} rows={2} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                    </label>
                    <button
                      disabled={saving || !customerName.trim()}
                      onClick={() => void post({ action: 'record_acceptance', accepted_by_name: customerName, acceptance_method: acceptanceMethod, note: acceptanceNote })}
                      className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Record customer acceptance
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm">
                    <p className="font-semibold text-emerald-200">Accepted by {acceptance.accepted_by_name}</p>
                    <p className="text-slate-300">
                      {describeAcceptanceMethod(acceptance.acceptance_method)} · {new Date(acceptance.accepted_at).toLocaleString()}
                    </p>
                    <p className="text-slate-300">Accepted total {money(acceptance.accepted_total)} (subtotal {money(acceptance.accepted_subtotal)}, tax {money(acceptance.accepted_tax)}) · formula {acceptance.estimate_formula_version || 'not stated'}</p>
                    {acceptance.note && <p className="text-slate-400">{acceptance.note}</p>}
                    <p className="text-xs text-slate-500">This record is immutable. It keeps the amount and time that were true when it was written.</p>
                  </div>
                )}

                {acceptance && depositState && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">Deposit</h3>
                      <span className="rounded bg-cyan-400/15 px-2 py-0.5 text-xs font-semibold text-cyan-200">{depositState.label}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Requested {money(depositState.requestedAmount)} · received {money(depositState.receivedAmount)} · refunded {money(depositState.refundedAmount)} · outstanding {money(depositState.outstandingAmount)}
                    </p>
                    {depositState.problem && <p role="alert" className="text-xs text-red-300">{depositState.problem}</p>}

                    {deposits.length > 0 && (
                      <ul className="space-y-1 text-xs text-slate-300">
                        {deposits.map((event) => (
                          <li key={event.id} className="rounded border border-white/10 bg-black/20 p-2">
                            <span className="font-semibold">{event.event_type}</span> {money(event.amount)}
                            {event.method ? ` · ${event.method}` : ''}{event.reference ? ` · ${event.reference}` : ''}
                            <span className="block text-slate-500">{new Date(event.occurred_at).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {depositState.nextAllowedEvents.length > 0 && (
                      <div className="space-y-2">
                        {depositState.nextAllowedEvents.includes('requested') && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="text-sm">
                              <span className="text-slate-300">Deposit amount</span>
                              <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" placeholder="0.00" />
                            </label>
                            <label className="text-sm">
                              <span className="text-slate-300">Reference (optional)</span>
                              <input value={depositReference} onChange={(event) => setDepositReference(event.target.value)} maxLength={200} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                            </label>
                          </div>
                        )}
                        {depositState.nextAllowedEvents.includes('received') && (
                          <div className="grid gap-2 sm:grid-cols-3">
                            <label className="text-sm">
                              <span className="text-slate-300">Received amount</span>
                              <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" placeholder="0.00" />
                            </label>
                            <label className="text-sm">
                              <span className="text-slate-300">Payment method</span>
                              <select value={depositMethod} onChange={(event) => setDepositMethod(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                                <option value="check">Check</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="ach">ACH</option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <label className="text-sm">
                              <span className="text-slate-300">Reference</span>
                              <input value={depositReference} onChange={(event) => setDepositReference(event.target.value)} maxLength={200} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                            </label>
                          </div>
                        )}
                        {depositState.nextAllowedEvents.includes('refunded') && (
                          <div className="grid gap-2 sm:grid-cols-3">
                            <label className="text-sm">
                              <span className="text-slate-300">Refund amount</span>
                              <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" placeholder="0.00" />
                            </label>
                            <label className="text-sm">
                              <span className="text-slate-300">Refund method</span>
                              <select value={depositMethod} onChange={(event) => setDepositMethod(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                                <option value="check">Check</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="ach">ACH</option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <label className="text-sm">
                              <span className="text-slate-300">Reference</span>
                              <input value={depositReference} onChange={(event) => setDepositReference(event.target.value)} maxLength={200} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                            </label>
                          </div>
                        )}
                        <label className="block text-sm">
                          <span className="text-slate-300">Note (optional)</span>
                          <input value={depositNote} onChange={(event) => setDepositNote(event.target.value)} maxLength={2000} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {depositState.nextAllowedEvents.includes('requested') && (
                            <button disabled={saving || !depositAmount} onClick={() => void post({ action: 'deposit_event', event_type: 'requested', amount: depositAmount, reference: depositReference, note: depositNote })} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Request deposit</button>
                          )}
                          {depositState.nextAllowedEvents.includes('received') && (
                            <button disabled={saving || !depositAmount} onClick={() => void post({ action: 'deposit_event', event_type: 'received', amount: depositAmount, method: depositMethod, reference: depositReference, note: depositNote })} className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60">Record deposit received</button>
                          )}
                          {depositState.nextAllowedEvents.includes('refunded') && (
                            <button disabled={saving || !depositAmount} onClick={() => void post({ action: 'deposit_event', event_type: 'refunded', amount: depositAmount, method: depositMethod, reference: depositReference, note: depositNote })} className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold hover:bg-amber-500 disabled:opacity-60">Record refund</button>
                          )}
                          {depositState.nextAllowedEvents.includes('waived') && (
                            <button disabled={saving} onClick={() => void post({ action: 'deposit_event', event_type: 'waived', note: depositNote })} className="rounded border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400/60 disabled:opacity-60">Waive deposit</button>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">Deposit events are append-only. Nothing here charges a card or moves money.</p>
                  </div>
                )}
              </section>
            )}
            {(job || canHandoff) && (
              <section className="rounded-xl border border-white/10 bg-slate-900 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Production handoff</h2>
                  {job && <span className="rounded bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">{describeProductionJobStatus(job.status)}</span>}
                </div>
                {jobError && <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-200">{jobError}</p>}
                {job ? (
                  <>
                    <dl className="grid gap-1 text-sm text-slate-300">
                      <div className="flex justify-between gap-3"><dt className="text-slate-400">Job number</dt><dd className="font-mono">{job.job_number}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-400">Customer</dt><dd>{job.customer_name}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-400">Property</dt><dd className="text-right">{job.property_address}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-400">Accepted total</dt><dd>{money(job.accepted_total)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-400">Accepted at</dt><dd>{new Date(job.accepted_at).toLocaleString()}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-400">Approved scope</dt><dd>{describeScopeLineCount(job)}</dd></div>
                    </dl>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {job.approved_scope.map((line) => (
                        <li key={line.line_item_id} className="rounded border border-white/10 bg-black/20 p-2">
                          <span className="font-semibold">{line.item_code}</span> {line.description} · {line.quantity} {line.unit} · {money(line.line_total)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-500">
                      This handoff keeps the customer, amount and scope that were true at acceptance. Later estimate edits do not change it.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">
                      The estimate is approved and the customer acceptance is recorded. Create the production job to hand this customer to the build team.
                    </p>
                    <button
                      disabled={creatingJob}
                      onClick={() => void createJob()}
                      className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {creatingJob ? 'Creating production job…' : 'Create production job'}
                    </button>
                    <p className="text-xs text-slate-500">
                      The job number, customer, accepted amount and approved scope are written by the database. The browser cannot choose them.
                    </p>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
