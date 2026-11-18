'use client'

import Link from 'next/link'
import RoofingWizardNavigator from '../../../components/RoofingWizardNavigator'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'

type Category = 'material' | 'labor' | 'allowance' | 'fee' | 'tax'
type Template = { id: string; name: string; description: string; sections: string[] }
type LineItem = { description: string; category: Category; unit: string; quantity: number; unit_cost: number }

const TEMPLATES: Template[] = [
  { id: 'roof-replacement', name: 'Roof replacement', description: 'Materials, tear-off, installation, permits, cleanup, and warranty.', sections: ['Roof covering', 'Tear-off and disposal', 'Installation labor', 'Permits', 'Cleanup', 'Warranty'] },
  { id: 'repair-estimate', name: 'Roof repair', description: 'A focused repair estimate for a leak, storm damage, or isolated defect.', sections: ['Repair materials', 'Repair labor', 'Access / protection', 'Cleanup'] },
  { id: 'siding-install', name: 'Siding installation', description: 'Full siding installation with trim and accessory work.', sections: ['Siding materials', 'Installation labor', 'Trim', 'Soffit', 'Fascia'] },
  { id: 'gutter-replacement', name: 'Gutter replacement', description: 'Gutters, downspouts, guards, and installation.', sections: ['Gutters', 'Downspouts', 'Guards', 'Installation'] },
  { id: 'window-replacement', name: 'Window replacement', description: 'Window units, installation, trim, and disposal.', sections: ['Window units', 'Installation', 'Interior / exterior trim', 'Disposal'] },
]

const CATEGORY_OPTIONS: { value: Category; label: string; unit: string }[] = [
  { value: 'material', label: 'Material', unit: 'EA' },
  { value: 'labor', label: 'Labor', unit: 'HR' },
  { value: 'allowance', label: 'Allowance', unit: 'EA' },
  { value: 'fee', label: 'Fee', unit: 'EA' },
  { value: 'tax', label: 'Tax', unit: 'EA' },
]

function blankLine(description = ''): LineItem {
  return { description, category: 'material', unit: 'EA', quantity: 1, unit_cost: 0 }
}

function itemsFor(template: Template | undefined): LineItem[] {
  return template?.sections.map((section) => blankLine(section)) ?? [blankLine()]
}

export default function NewEstimatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTemplate = searchParams.get('template') || 'roof-replacement'
  const sourceMeasurementId = searchParams.get('measurementId') || ''
  const [templateId, setTemplateId] = useState(initialTemplate)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState(() => (searchParams.get('address') || '').slice(0, 240))
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [notes, setNotes] = useState('')
  const [sourceMeasurement, setSourceMeasurement] = useState<{
    id: string; roofSquares: number | null; roofAreaSqFt: number | null;
    sourceType: string; confidence: string;
  } | null>(null)
  const [sourceMeasurementStatus, setSourceMeasurementStatus] = useState('')
  const [propertyMatched, setPropertyMatched] = useState(false)
  const [lineItems, setLineItems] = useState<LineItem[]>(() => itemsFor(TEMPLATES.find((item) => item.id === initialTemplate)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sourceMeasurementId) return
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceMeasurementId)) {
      setSourceMeasurementStatus('Invalid measurement reference. Open the measurement page or remove the link.')
      return
    }
    let active = true
    async function loadMeasurement() {
      try {
        const supabase = createClient()
        const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
        if (workspaceError || !workspaceId) throw new Error('No active workspace')
        const { data, error: lookupError } = await supabase.from('inspection_measurements')
          .select('id,roof_squares,roof_area_sqft,source_type,confidence')
          .eq('id', sourceMeasurementId).eq('workspace_id', workspaceId).maybeSingle()
        if (lookupError || !data) throw new Error('Measurement not found in this workspace')
        if (!active) return
        setSourceMeasurement({
          id: data.id,
          roofSquares: Number.isFinite(Number(data.roof_squares)) && data.roof_squares != null ? Number(data.roof_squares) : null,
          roofAreaSqFt: Number.isFinite(Number(data.roof_area_sqft)) && data.roof_area_sqft != null ? Number(data.roof_area_sqft) : null,
          sourceType: String(data.source_type),
          confidence: String(data.confidence),
        })
        setSourceMeasurementStatus('Source measurement loaded for review only. Its quantities are not added to estimate line items.')
      } catch {
        if (active) {
          setSourceMeasurement(null)
          setSourceMeasurementStatus('Measurement unavailable for this workspace. No quantities imported. Remove the reference or return to measurements.')
        }
      }
    }
    void loadMeasurement()
    return () => { active = false }
  }, [sourceMeasurementId])

  const selectedTemplate = TEMPLATES.find((item) => item.id === templateId)
  const previewTotal = useMemo(() => lineItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_cost) || 0), 0), [lineItems])

  const chooseTemplate = (id: string) => {
    setTemplateId(id)
    setLineItems(itemsFor(TEMPLATES.find((item) => item.id === id)))
  }

  const updateItem = (index: number, patch: Partial<LineItem>) => setLineItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))

  const createEstimate = async () => {
    if (saving) return
    if (sourceMeasurementId && (!sourceMeasurement || !propertyMatched)) {
      setError('Confirm the property matches the reviewed measurement before creating an estimate draft.')
      return
    }
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          property_address: address,
          property_city: city,
          property_state: state,
          property_zip: zip,
          notes_customer: notes,
          source_measurement_id: sourceMeasurement?.id ?? undefined,
          line_items: lineItems,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.estimate?.id) throw new Error(payload.error || 'Could not create estimate.')
      router.push(`/estimate/${payload.estimate.id}/edit`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create estimate. Check your connection.')
    } finally { setSaving(false) }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
        <RoofingWizardNavigator active="/estimate/new" />

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><Link href="/estimate" className="text-sm text-cyan-300 hover:underline">← Estimates</Link><h1 className="mt-2 text-3xl font-black">Create an estimate</h1><p className="mt-1 text-sm text-slate-400">Start from a template, enter what you know, and save a review-gated draft. Prices remain zero until you add a verified price book.</p></div>
          <Link href="/templates" className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">Manage templates</Link>
        </header>
        {sourceMeasurementId && <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <h2 className="font-semibold">Measurement handoff — review required</h2>
          <p className="mt-2">{sourceMeasurementStatus || 'Checking this measurement in your workspace…'}</p>
          {sourceMeasurement && <>
            <p className="mt-2">Source: {sourceMeasurement.id} · {sourceMeasurement.sourceType} · {sourceMeasurement.confidence} confidence.</p>
            <p>Candidate quantities: {sourceMeasurement.roofSquares == null ? 'squares unavailable' : sourceMeasurement.roofSquares.toFixed(2) + ' squares'}; {sourceMeasurement.roofAreaSqFt == null ? 'area unavailable' : sourceMeasurement.roofAreaSqFt.toFixed(1) + ' sq ft'}. No priced material quantities are authorized.</p>
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={propertyMatched} onChange={(event) => setPropertyMatched(event.target.checked)} />
              I checked that the measurement belongs to the property entered below.
            </label>
          </>}
          <button type="button" className="mt-3 text-xs underline" onClick={() => {
            const params = new URLSearchParams()
            if (address.trim()) params.set('address', address.trim().slice(0, 240))
            router.replace('/estimate/new' + (params.toString() ? '?' + params.toString() : ''))
          }}>Start a new draft without this measurement</button>
        </section>}
        {error && <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-red-200">{error}</p>}
        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {TEMPLATES.map((template) => <button type="button" key={template.id} onClick={() => chooseTemplate(template.id)} className={`rounded-xl border p-4 text-left transition ${template.id === templateId ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-slate-900 hover:border-cyan-400/40'}`}><p className="font-semibold">{template.name}</p><p className="mt-1 text-xs text-slate-400">{template.description}</p><p className="mt-3 text-xs text-cyan-200">{template.sections.length} starter line items</p></button>)}
        </section>
        <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{selectedTemplate?.name ?? 'Blank estimate'}</h2><p className="text-xs text-slate-400">Edit these starter rows below. Empty prices are intentional until reviewed against your price book.</p></div><button type="button" onClick={() => { setTemplateId('blank'); setLineItems([blankLine()]) }} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-300">Start blank</button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([['Customer name', customerName, setCustomerName], ['Customer email', customerEmail, setCustomerEmail], ['Customer phone', customerPhone, setCustomerPhone], ['Property address', address, setAddress], ['City', city, setCity], ['State', state, setState], ['ZIP code', zip, setZip]] as const).map(([label, value, setter]) => <label key={label} className="text-sm text-slate-300">{label}<input value={value} onChange={(event) => setter(event.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2.5 text-white" /></label>)}
          </div>
          <label className="mt-3 block text-sm text-slate-300">Customer-facing notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2.5 text-white" placeholder="Scope notes, exclusions, or follow-up details" /></label>
          <div className="mt-6 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Line items</h2><button type="button" onClick={() => setLineItems((items) => [...items, blankLine()])} className="rounded-lg border border-cyan-500 px-3 py-2 text-sm text-cyan-200">Add line item</button></div>
          <div className="mt-3 space-y-3">{lineItems.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-12"><label className="sm:col-span-5 text-xs text-slate-300">Description<input value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" /></label><label className="sm:col-span-2 text-xs text-slate-300">Category<select value={item.category} onChange={(event) => { const category = event.target.value as Category; updateItem(index, { category, unit: CATEGORY_OPTIONS.find((option) => option.value === category)?.unit ?? item.unit }) }} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white">{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="sm:col-span-2 text-xs text-slate-300">Unit<input value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" /></label><label className="sm:col-span-1 text-xs text-slate-300">Qty<input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" /></label><label className="sm:col-span-2 text-xs text-slate-300">Unit cost<input type="number" min="0" step="any" value={item.unit_cost} onChange={(event) => updateItem(index, { unit_cost: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-white" /></label><button type="button" onClick={() => setLineItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-left text-xs text-red-300 sm:col-span-12">Remove row</button></div>)}</div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><p className="text-sm text-slate-400">Draft preview total <strong className="text-xl text-emerald-300">${previewTotal.toFixed(2)}</strong></p><button type="button" onClick={() => void createEstimate()} disabled={saving || Boolean(sourceMeasurementId && (!sourceMeasurement || !propertyMatched))} className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{saving ? 'Creating draft…' : 'Create estimate draft'}</button></div>
        </section>
      </div>
    </main>
  )
}
