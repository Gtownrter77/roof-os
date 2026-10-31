'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Category = 'material' | 'labor' | 'allowance' | 'fee' | 'tax'
type LineItem = {
  id?: string
  item_code: string
  description: string
  category: Category
  unit: string
  quantity: number
  unit_cost: number
}

type Estimate = {
  id: string
  status: string
  total: number
  estimate_snapshot?: {
    customer?: { name?: string; email?: string; phone?: string }
    property?: { address?: string; city?: string; state?: string; zip?: string }
    notes?: { customer?: string; internal?: string }
  }
  line_items?: LineItem[]
}

type Details = {
  customer_name: string
  customer_email: string
  customer_phone: string
  property_address: string
  property_city: string
  property_state: string
  property_zip: string
  notes_customer: string
  notes_internal: string
}

const initialDetails: Details = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  property_address: '',
  property_city: '',
  property_state: '',
  property_zip: '',
  notes_customer: '',
  notes_internal: '',
}

function readDetails(estimate: Estimate): Details {
  const snapshot = estimate.estimate_snapshot
  return {
    customer_name: snapshot?.customer?.name ?? '',
    customer_email: snapshot?.customer?.email ?? '',
    customer_phone: snapshot?.customer?.phone ?? '',
    property_address: snapshot?.property?.address ?? '',
    property_city: snapshot?.property?.city ?? '',
    property_state: snapshot?.property?.state ?? '',
    property_zip: snapshot?.property?.zip ?? '',
    notes_customer: snapshot?.notes?.customer ?? '',
    notes_internal: snapshot?.notes?.internal ?? '',
  }
}

async function saveEstimatePart(id: string, payload: unknown): Promise<Estimate> {
  const response = await fetch('/api/estimates/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.estimate) {
    throw new Error(data.error || 'Could not save estimate.')
  }
  return data.estimate as Estimate
}

export default function EditEstimatePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [details, setDetails] = useState<Details>(initialDetails)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'details' | 'items' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetch('/api/estimates/' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.estimate) throw new Error(data.error || 'Estimate not found.')
        const loaded = data.estimate as Estimate
        setEstimate(loaded)
        setDetails(readDetails(loaded))
        setLineItems((loaded.line_items || []).map(item => ({
          item_code: item.item_code || '',
          description: item.description || '',
          category: item.category,
          unit: item.unit || 'ea',
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
        })))
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load estimate.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id])

  const isEditable = estimate?.status === 'draft' || estimate?.status === 'pending_approval'

  const saveDetails = async () => {
    if (!id || !isEditable || saving) return
    setSaving('details')
    setError('')
    setNotice('')
    try {
      const updated = await saveEstimatePart(id, details)
      setEstimate(updated)
      setNotice('Customer and property details saved. Any line item changes must be saved separately.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save details.')
    } finally {
      setSaving(null)
    }
  }

  const saveLines = async () => {
    if (!id || !isEditable || saving) return
    setError('')
    setNotice('')
    if (lineItems.some(item =>
      !item.description.trim() || !item.unit.trim() ||
      !Number.isFinite(item.quantity) || item.quantity < 0 ||
      !Number.isFinite(item.unit_cost) || item.unit_cost < 0
    )) {
      setError('Every line item needs a description, unit, and nonnegative quantity and cost.')
      return
    }
    setSaving('items')
    try {
      const updated = await saveEstimatePart(id, {
        line_items: lineItems.map((item, index) => ({
          item_code: item.item_code || 'ITEM-' + (index + 1),
          description: item.description.trim(),
          category: item.category,
          unit: item.unit.trim(),
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          sort_order: index,
        })),
      })
      setEstimate(updated)
      setNotice('Line items saved and totals recalculated on the server. Customer details are saved separately.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save line items.')
    } finally {
      setSaving(null)
    }
  }

  const sendForReview = async () => {
    if (!id || !isEditable || saving) return
    setSaving('details')
    setError('')
    setNotice('')
    try {
      const updated = await saveEstimatePart(id, { status: 'pending_approval' })
      setEstimate(updated)
      setNotice('Estimate sent for review. Approval is still required before external use.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send estimate for review.')
    } finally {
      setSaving(null)
    }
  }

  const setItem = (index: number, patch: Partial<LineItem>) =>
    setLineItems(previous => previous.map((item, i) => i === index ? { ...item, ...patch } : item))

  const fields: { key: keyof Details; label: string; type?: string }[] = [
    { key: 'customer_name', label: 'Customer name' },
    { key: 'customer_email', label: 'Customer email', type: 'email' },
    { key: 'customer_phone', label: 'Customer phone', type: 'tel' },
    { key: 'property_address', label: 'Property address' },
    { key: 'property_city', label: 'City' },
    { key: 'property_state', label: 'State' },
    { key: 'property_zip', label: 'ZIP code' },
  ]

  const previewTotal = lineItems.reduce((sum, item) => sum + (Number.isFinite(item.quantity * item.unit_cost) ? item.quantity * item.unit_cost : 0), 0)
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/estimate" className="text-sm text-cyan-300 hover:underline">← All estimates</Link>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Estimate workspace</p>
              <h1 className="mt-1 text-2xl font-black">{estimate?.estimate_snapshot?.customer?.name || 'New customer estimate'}</h1>
              <p className="mt-1 text-sm text-slate-400">{estimate?.estimate_snapshot?.property?.address || 'Add the customer and job address below'}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase text-amber-200">{estimate?.status?.replaceAll('_', ' ') || 'loading'}</span>
              <button onClick={() => router.push('/templates')} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200">Templates</button>
              {isEditable && <button onClick={sendForReview} disabled={saving !== null} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{saving === 'details' ? 'Saving…' : 'Send for review'}</button>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Estimate number</p><p className="font-semibold">EST-{id ? id.slice(0, 8).toUpperCase() : '--------'}</p></div><div><p className="text-xs text-slate-500">Current total</p><p className="font-semibold text-emerald-300">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(estimate?.total ?? 0))}</p></div><div><p className="text-xs text-slate-500">Workflow</p><p className="font-semibold">Draft → review → approval</p></div></div>
        </header>
        {loading && <p role="status">Loading estimate…</p>}
        {error && <p role="alert" className="rounded-lg border border-red-500 p-3 text-red-200">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-500 p-3 text-emerald-200">{notice}</p>}
        {!loading && estimate && !isEditable && (
          <div className="rounded-lg border border-amber-400 p-4 text-amber-200">
            This {estimate.status.replaceAll('_', ' ')} estimate is locked. No changes are permitted.
          </div>
        )}
        {!loading && estimate && isEditable && (
          <>
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5 space-y-4">
              <h2 className="font-bold">Customer and property</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map(field => (
                  <label key={field.key} className="space-y-1 text-sm">
                    <span className="block text-slate-300">{field.label}</span>
                    <input type={field.type || 'text'} value={details[field.key]} onChange={event => setDetails(previous => ({ ...previous, [field.key]: event.target.value }))}
                      className="w-full rounded border border-slate-600 bg-slate-800 p-2.5 text-white" />
                  </label>
                ))}
              </div>
              <label className="block space-y-1 text-sm">
                <span>Notes for customer</span>
                <textarea value={details.notes_customer} onChange={event => setDetails(previous => ({ ...previous, notes_customer: event.target.value }))}
                  rows={3} className="w-full rounded border border-slate-600 bg-slate-800 p-2.5 text-white" />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Internal notes (not customer-facing)</span>
                <textarea value={details.notes_internal} onChange={event => setDetails(previous => ({ ...previous, notes_internal: event.target.value }))}
                  rows={3} className="w-full rounded border border-slate-600 bg-slate-800 p-2.5 text-white" />
              </label>
              <button onClick={saveDetails} disabled={saving !== null} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-50">
                {saving === 'details' ? 'Saving…' : 'Save customer details'}
              </button>
            </section>

            <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Measurements & source documents</h2><p className="mt-1 text-sm text-slate-400">Use reviewed roof geometry and a marked-up photo as job context. Quantities still require human verification before pricing or approval.</p></div><div className="flex gap-2"><Link href="/measure" className="rounded-lg border border-cyan-500 px-3 py-2 text-sm text-cyan-200">Aerial measurement</Link><Link href="/sketch" className="rounded-lg border border-cyan-500 px-3 py-2 text-sm text-cyan-200">Roof sketch</Link></div></div></section>
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-bold">Scope and line items</h2><p className="mt-1 text-xs text-slate-400">Organize materials, labor, allowances, fees, and taxes. Server totals are authoritative after save.</p></div><span className="text-sm text-slate-400">{lineItems.length} rows</span>
                <button onClick={() => setLineItems(previous => [...previous, { item_code: '', description: '', category: 'material', unit: 'ea', quantity: 1, unit_cost: 0 }])}
                  className="rounded-lg border border-cyan-500 px-3 py-2 text-cyan-200 hover:bg-cyan-500/10">Add line item</button>
              </div>
              <p className="text-xs text-slate-400">Amounts are entered manually and must be verified against the owner price book and job measurements. Saving these lines does not approve an estimate.</p>
              {lineItems.length === 0 && <p className="text-slate-400">No items yet. Add an item to build a draft.</p>}
              {lineItems.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-12">
                  <label className="sm:col-span-5 text-xs">Description
                    <input value={item.description} onChange={event => setItem(index, { description: event.target.value })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" />
                  </label>
                  <label className="sm:col-span-3 text-xs">Category
                    <select value={item.category} onChange={event => setItem(index, { category: event.target.value as Category })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white">
                      {(['material', 'labor', 'allowance', 'fee', 'tax'] as const).map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="sm:col-span-2 text-xs">Unit
                    <input value={item.unit} onChange={event => setItem(index, { unit: event.target.value })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" />
                  </label>
                  <button aria-label={'Remove line item ' + (index + 1)} onClick={() => setLineItems(previous => previous.filter((_, i) => i !== index))}
                    className="sm:col-span-2 self-end rounded border border-red-500/40 px-3 py-2 text-sm text-red-200">Remove</button>
                  <label className="sm:col-span-3 text-xs">Quantity
                    <input type="number" min={0} step="any" value={item.quantity} onChange={event => setItem(index, { quantity: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" />
                  </label>
                  <label className="sm:col-span-3 text-xs">Unit cost ($)
                    <input type="number" min={0} step="any" value={item.unit_cost} onChange={event => setItem(index, { unit_cost: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" />
                  </label>
                  <span className="sm:col-span-6 self-end text-sm text-slate-300">Line total: {money(item.quantity * item.unit_cost)}</span>
                </div>
              ))}
              <div className="text-right text-lg font-semibold">Preview total: {money(previewTotal)} <span className="block text-xs font-normal text-slate-400">Server-calculated total is authoritative after save.</span></div>
              <button onClick={saveLines} disabled={saving !== null} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-50">
                {saving === 'items' ? 'Saving…' : 'Save line items'}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
