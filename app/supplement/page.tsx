'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { smartBack } from '../../lib/smart-back'
import RoofingWorkflowSettings from '../../components/RoofingWorkflowSettings'
import RoofingWizardNavigator from '../../components/RoofingWizardNavigator'

type Supplement = { id: string; title: string; description: string; job_address: string; additional_cost: number; status: string; urgency: string }
type Urgency = 'low' | 'medium' | 'high' | 'critical'
// Scope examples have NO fabricated pricing or findings.
const examples: Array<{ title: string; prompt: string; urgency: Urgency }> = [
  { title: 'Roof Decking', prompt: 'Describe the actual damaged decking, units, removal and replacement.', urgency: 'high' },
  { title: 'Flashing Repair', prompt: 'Document the affected flashing detail and the verified additional scope.', urgency: 'medium' },
  { title: 'Gutter / Downspout', prompt: 'Document measured runs and existing conditions before requesting additional work.', urgency: 'medium' },
]

export default function SupplementPage() {
  const router = useRouter()
  const [jobAddress, setJobAddress] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('medium')
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [materials, setMaterials] = useState('')
  const [laborDescription, setLaborDescription] = useState('')
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch('/api/supplements', { signal, cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (signal?.aborted) return
      if (response.ok) setSupplements(Array.isArray(result.supplements) ? result.supplements : [])
      else setMessage(result.error ?? 'Could not load supplements.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('Could not load supplements due to a network error.')
    }
  }
  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get('address')?.trim()
    if (candidate && candidate.length <= 240) setJobAddress((existing) => existing || candidate)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const readiness = [
    { label: 'Property address', ready: jobAddress.trim().length > 0 },
    { label: 'Scope title', ready: title.trim().length > 0 },
    { label: 'Field findings', ready: description.trim().length > 0 && !examples.some((item) => item.prompt === description.trim()) },
    { label: 'Inspection evidence', ready: evidenceNotes.trim().length > 0 },
    { label: 'Owner-entered amount', ready: amount.trim().length > 0 && Number.isFinite(Number(amount)) && Number(amount) >= 0 && Number(amount) <= 1_000_000 },
  ]
  const readyCount = readiness.filter((item) => item.ready).length
  const reviewSummary = [
    'INTERNAL SUPPLEMENT REVIEW DRAFT - NOT SENT TO INSURER',
    'Property: ' + jobAddress.trim(),
    'Scope: ' + title.trim(),
    'Findings: ' + description.trim(),
    'Evidence: ' + evidenceNotes.trim(),
    'Materials: ' + materials.trim(),
    'Labor: ' + laborDescription.trim(),
    'Owner-entered amount: ' + (readiness[4].ready ? '$' + Number(amount).toFixed(2) : 'NOT ENTERED'),
    'Approval required before external submission.',
  ].join('\\n')
  async function copyReviewSummary() {
    if (readyCount !== readiness.length) {
      setMessage('Complete the checklist before copying the draft.')
      return
    }
    try {
      await navigator.clipboard.writeText(reviewSummary)
      setMessage('Internal review summary copied. Nothing was sent externally.')
    } catch {
      setMessage('Clipboard unavailable. You can still save the internal draft.')
    }
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const cost = Number(amount)
    if (readyCount !== readiness.length || !jobAddress.trim() || !title.trim() || !description.trim() || examples.some((example) => example.prompt === description.trim()) || !evidenceNotes.trim()
        || amount.trim() === '' || !Number.isFinite(cost) || cost < 0 || cost > 1_000_000) {
      setMessage('Enter a job address, real findings, supporting evidence, and your own amount between $0 and $1,000,000.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobAddress: jobAddress.trim(),
          title: title.trim(),
          description: description.trim(),
          additionalCost: cost,
          urgency,
          materials: materials.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 30),
          laborDescription: laborDescription.trim(),
          evidence: {
            source: 'owner_entered_field_review',
            inspectionNotes: evidenceNotes.trim(),
            priceSource: 'owner_entered_unverified',
          },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Could not save supplement.')
      setMessage('Saved as needs_review. No insurer submission, customer approval, or payment was initiated.')
      setTitle(''); setDescription(''); setAmount(''); setEvidenceNotes(''); setMaterials(''); setLaborDescription('')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save supplement.')
    } finally {
      setBusy(false)
    }
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    if (busy) return
    if (status === 'approved' && !window.confirm('Approve this INTERNAL review record? This does NOT approve any insurer claim or customer work.')) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/supplements', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Could not update supplement review.')
      setMessage(status === 'approved' ? 'Internally approved for review, not submitted to an insurer.' : 'Draft rejected.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update supplement.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-12">
    <RoofingWizardNavigator active="/supplement" />
    <RoofingWorkflowSettings compact />
    <header className="glass rounded-xl p-4 flex items-center gap-3">
      <button type="button" onClick={() => smartBack(router)} aria-label="Go back" className="text-cyan-300">←</button>
      <div className="flex-1"><h1 className="text-xl font-bold">Supplement Wizard</h1><p className="text-xs text-slate-400">Scope → evidence → owner pricing → internal review</p></div>
      <Link href="/supplement/review" className="text-xs text-cyan-300">Agent 5 drafts</Link>
    </header>
    <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">No preset prices or fabricated inspection evidence. This creates an internal review draft only—not an insurance submission.</p>
    <form onSubmit={(event) => void saveCandidate(event)} className="glass space-y-5 rounded-xl p-5">
      <section className="space-y-3">
        <h2 className="font-semibold">1. Property and scope</h2>
        <label className="block text-sm">Job address<input required maxLength={240} value={jobAddress} onChange={(event) => setJobAddress(event.target.value)} className="ops-input mt-1 w-full" placeholder="Street address, city, state, ZIP" /></label>
        <div className="grid gap-2 sm:grid-cols-3">
          {examples.map((example) => <button key={example.title} type="button" onClick={() => { setTitle(example.title); setDescription(example.prompt); setUrgency(example.urgency); setMessage('Replace the scope example with real field findings and your own price.') }} className="rounded border border-white/20 p-3 text-left text-sm hover:border-cyan-400"><strong>{example.title}</strong><span className="block text-xs text-slate-400">Scope template · No price</span></button>)}
        </div>
        <label className="block text-sm">Supplement title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="ops-input mt-1 w-full" placeholder="Change request title" /></label>
        <label className="block text-sm">Actual findings and additional scope<textarea required rows={3} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} className="ops-input mt-1 w-full" placeholder="What was observed, measured, and why is this additional work?" /></label>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">2. Evidence and work details</h2>
        <label className="block text-sm">Inspection evidence, photo references and field notes<textarea required rows={3} maxLength={3000} value={evidenceNotes} onChange={(event) => setEvidenceNotes(event.target.value)} className="ops-input mt-1 w-full" placeholder="Actual photo IDs, inspection notes, quantities or sources" /></label>
        <label className="block text-sm">Materials (one per line)<textarea rows={2} value={materials} onChange={(event) => setMaterials(event.target.value)} className="ops-input mt-1 w-full" placeholder="Measured material descriptions" /></label>
        <label className="block text-sm">Labor scope<textarea rows={2} value={laborDescription} onChange={(event) => setLaborDescription(event.target.value)} className="ops-input mt-1 w-full" /></label>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">3. Owner-entered pricing</h2>
        <label className="block text-sm">Additional amount ($), entered by you<input required type="number" min="0" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="ops-input mt-1 w-full" placeholder="No default amount" /></label>
        <label className="block text-sm">Urgency<select value={urgency} onChange={(event) => setUrgency(event.target.value as Urgency)} className="ops-input mt-1 w-full"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <p className="text-xs text-slate-400">No licensed carrier price list or verified supplier price is implied by this input.</p>
      </section>
      <section className="rounded-xl border border-white/20 p-3">
        <h2 className="font-semibold">4. Review and save</h2>
        <p className="mt-1 text-xs text-slate-400">Address: {jobAddress.trim() || 'Not entered'} · Scope: {title.trim() || 'Not entered'} · Amount: {amount.trim() ? '$' + Number(amount).toFixed(2) : 'Not entered'}</p>
        <div aria-label="Automatic supplement draft completeness check" className="mt-3 rounded-lg border border-white/15 p-3">
          <p className="text-sm font-semibold">Automatic review check: {readyCount}/{readiness.length} ready</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {readiness.map((item) => <p key={item.label} className={'text-xs ' + (item.ready ? 'text-emerald-300' : 'text-amber-200')}>{item.ready ? '✓' : '○'} {item.label}</p>)}
          </div>
          <p className="mt-2 text-xs text-slate-400">Completeness is not proof of accuracy, coverage, or carrier approval.</p>
          <button type="button" disabled={busy || readyCount !== readiness.length} onClick={() => void copyReviewSummary()} className="mt-2 rounded border border-white/20 px-3 py-2 text-xs disabled:opacity-40">Copy internal review summary</button>
        </div>
        <button type="submit" disabled={busy || readyCount !== readiness.length} className="mt-3 rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save needs-review draft'}</button>
      </section>
    </form>
    {message && <p role="status" className="rounded border border-cyan-400/20 p-3 text-sm text-cyan-200">{message}</p>}
    <section className="space-y-3">
      <h2 className="font-semibold">Existing supplement drafts</h2>
      {supplements.length === 0 && <p className="text-sm text-slate-400">No drafts found.</p>}
      {supplements.map((item) => <article key={item.id} className="glass rounded-xl p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className="text-cyan-300">{'$' + Number(item.additional_cost).toFixed(2)}</span></div>
        <p className="text-xs text-slate-400">{item.job_address} · {item.status}</p><p className="mt-2 text-sm">{item.description}</p>
        {item.status === 'needs_review' && <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void review(item.id, 'approved')} className="rounded bg-emerald-700 px-3 py-2 text-xs disabled:opacity-50">Approve internal record</button><button type="button" disabled={busy} onClick={() => void review(item.id, 'rejected')} className="rounded bg-red-800 px-3 py-2 text-xs disabled:opacity-50">Reject draft</button></div>}
      </article>)}
    </section>
  </main>
}
