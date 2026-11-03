'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import { getCanvassAdvice, ObjectionType } from '../../lib/ai/canvass-mentor'
import {
  CANVASS_LEAD_SOURCE,
  CanvassOutcome,
} from '../../lib/canvass'

type CanvassLead = {
  id: string
  name: string
  address: string
  status: string
  phone: string | null
  next_action: string | null
  lost_reason_detail: string | null
  last_activity_at: string | null
  updated_at?: string | null
}

const outcomeColors: Record<CanvassOutcome, string> = {
  INTERESTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  INSPECTED: 'bg-blue-100 text-blue-900 border-blue-300',
  NOT_HOME: 'bg-amber-100 text-amber-800 border-amber-300',
  DO_NOT_KNOCK: 'bg-red-100 text-red-800 border-red-300',
}

function outcomeFromLead(lead: CanvassLead): CanvassOutcome | null {
  if ((lead.lost_reason_detail || '').toLowerCase().includes('do not knock')) return 'DO_NOT_KNOCK'
  if (lead.status === 'lost') return null
  if (lead.status === 'inspected' || lead.status === 'report_pending' || lead.status === 'report_approved') {
    return 'INSPECTED'
  }
  if ((lead.next_action || '').toLowerCase().includes('return visit')) return 'NOT_HOME'
  if (lead.status === 'new' || lead.status === 'qualified' || lead.status === 'assigned') return 'INTERESTED'
  return null
}

export default function CanvassPage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<CanvassLead[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [selectedObjection, setSelectedObjection] = useState<ObjectionType>('NO_DAMAGE')
  const [showVCard, setShowVCard] = useState(false)
  const [leadConversionEnabled, setLeadConversionEnabled] = useState(false)
  const [vCardEnabled, setVCardEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [form, setForm] = useState({
    address: '',
    homeownerName: '',
    phone: '',
    outcome: 'INTERESTED' as CanvassOutcome,
    notes: '',
  })

  const advice = getCanvassAdvice({
    address: form.address.trim(),
    objection: selectedObjection,
  })

  const loadCanvassLeads = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/auth/login?next=/canvass')
      return
    }
    const { data, error: queryError } = await supabase
      .from('leads')
      .select('id,name,address,status,phone,next_action,lost_reason_detail,last_activity_at,updated_at')
      .eq('source', CANVASS_LEAD_SOURCE)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (queryError) setError(queryError.message)
    else setLeads(data ?? [])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    void loadCanvassLeads()
  }, [loadCanvassLeads])

  useEffect(() => {
    let active = true
    fetch('/api/settings', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload.settings) throw new Error('Workspace settings could not be verified.')
        if (!active) return
        setLeadConversionEnabled(payload.settings.enable_canvassing_lead_auto_convert === true)
        setVCardEnabled(payload.settings.enable_vcard_digital_business_card === true)
      })
      .catch(() => {
        if (active) setSettingsError('Workspace settings could not be verified. Saving is paused until settings can be loaded.')
      })
      .finally(() => {
        if (active) setSettingsLoading(false)
      })
    return () => { active = false }
  }, [])

  async function logKnock(e: FormEvent) {
    e.preventDefault()
    const address = form.address.trim()
    if (!address) return

    if (settingsLoading || settingsError || !leadConversionEnabled) {
      setError(settingsError || 'Canvass lead conversion is turned off for this workspace. Change it in workspace settings before saving leads.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/canvass')
        return
      }
      const { data: savedRows, error: saveError } = await supabase.rpc('log_canvass_knock', {
        p_address: address,
        p_name: form.homeownerName.trim() || null,
        p_phone: form.phone.trim() || null,
        p_notes: form.notes.trim() || null,
        p_outcome: form.outcome,
      })
      if (saveError) throw saveError
      const saved = savedRows?.[0]
      if (!saved?.lead_id) throw new Error('The canvass result was not confirmed as saved.')

      setForm({ address: '', homeownerName: '', phone: '', outcome: 'INTERESTED', notes: '' })
      setNotice(saved.created ? 'Knock saved to the workspace Leads and activity.' : 'Existing canvass lead and activity updated together.')
      await loadCanvassLeads()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Canvass result was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="-mx-4 min-h-screen bg-[#f5f2eb] px-4 pb-12 pt-4 text-[#21352e] sm:px-6 lg:-mx-8 lg:px-8">
      <main className="mx-auto max-w-6xl space-y-7">
        <header className="relative isolate overflow-hidden rounded-[30px] bg-[#183d32] px-5 py-6 text-white shadow-[0_24px_60px_-35px_rgba(24,61,50,.8)] sm:px-8 sm:py-8">
          <div aria-hidden="true" className="absolute -right-14 -top-24 -z-10 h-72 w-72 rounded-full border-[34px] border-[#91ad8d]/15" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button type="button" onClick={() => smartBack(router, '/leads')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#d8e4d6] transition hover:text-white">
              <span aria-hidden="true">←</span> Back to workspace
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => router.push('/leads?source=canvass')} className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10">Your canvass leads</button>
              {vCardEnabled && <button type="button" onClick={() => setShowVCard((open) => !open)} className="rounded-full bg-[#d7e6ce] px-4 py-2 text-sm font-bold text-[#183d32] transition hover:bg-white">Share card</button>}
            </div>
          </div>
          <div className="mt-9 grid items-end gap-7 md:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[.24em] text-[#c5d8be]">Field notes · canvass</p>
              <h1 className="mt-3 max-w-xl font-serif text-4xl leading-[1.04] tracking-[-.04em] sm:text-5xl">Make room for a real conversation.</h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#d8e4d6]">Capture the doorstep, not a paperwork pile. A knock becomes a workspace lead with its activity saved in the same transaction.</p>
            </div>
            <div className="min-w-[170px] rounded-2xl border border-white/15 bg-white/[.08] px-5 py-4 backdrop-blur-sm">
              <p className="text-xs font-medium text-[#c5d8be]">In your canvass list</p>
              <p className="mt-1 font-serif text-4xl">{loading ? '—' : leads.length}</p>
              <p className="mt-1 text-xs text-white/65">{loading ? 'Checking workspace' : 'Live from workspace CRM'}</p>
            </div>
          </div>
        </header>

        {notice && <div className="rounded-2xl border border-[#bad4bd] bg-[#e8f1e7] px-5 py-4 text-sm font-semibold text-[#234b38]" role="status">{notice}</div>}
        {error && <div className="rounded-2xl border border-[#edc2b6] bg-[#fff0eb] px-5 py-4 text-sm font-semibold text-[#813c2e]" role="alert">{error}</div>}

        {showVCard && <section className="rounded-2xl border border-[#d5dfd0] bg-white p-5 sm:flex sm:items-center sm:justify-between"><div><h2 className="font-serif text-xl">Business card is not set up yet</h2><p className="mt-1 text-sm text-[#68766e]">Add verified company contact details before sharing a card from the field.</p></div><span className="mt-3 inline-flex rounded-full bg-[#f5f2eb] px-3 py-1 text-xs font-bold text-[#55665b] sm:mt-0">Not configured</span></section>}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(290px,.8fr)]">
          <form onSubmit={(e) => void logKnock(e)} className="rounded-[28px] border border-[#e5dfd4] bg-white p-5 shadow-[0_18px_50px_-38px_rgba(31,53,43,.35)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8a7255]">A quick field note</p><h2 className="mt-2 font-serif text-3xl tracking-tight">Who did you meet?</h2><p className="mt-2 text-sm text-[#728078]">Address is all you need. Add the rest if it feels right.</p></div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${settingsLoading ? 'bg-[#f5f2eb] text-[#68766e]' : leadConversionEnabled ? 'bg-[#e8f1e7] text-[#315d42]' : 'bg-[#fff0eb] text-[#813c2e]'}`}>{settingsLoading ? 'Checking workspace' : leadConversionEnabled ? 'Ready to save' : 'Saving paused'}</span>
            </div>
            <div className="mt-7 space-y-5">
              <label className="block"><span className="mb-2 block text-sm font-bold">Property address <span className="text-[#b45d3d]">*</span></span><input autoComplete="street-address" type="text" required placeholder="Start with the street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-2xl border border-[#ddd7cb] bg-[#fbfaf7] px-4 py-4 text-base outline-none transition placeholder:text-[#a5aaa3] focus:border-[#65866d] focus:ring-4 focus:ring-[#65866d]/10" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-semibold">Homeowner <span className="font-normal text-[#89928c]">optional</span></span><input autoComplete="name" type="text" placeholder="Name" value={form.homeownerName} onChange={(e) => setForm({ ...form, homeownerName: e.target.value })} className="w-full rounded-2xl border border-[#ddd7cb] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#a5aaa3] focus:border-[#65866d] focus:ring-4 focus:ring-[#65866d]/10" /></label>
                <label className="block"><span className="mb-2 block text-sm font-semibold">Phone <span className="font-normal text-[#89928c]">optional</span></span><input autoComplete="tel" type="tel" placeholder="Best number to reach them" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-[#ddd7cb] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#a5aaa3] focus:border-[#65866d] focus:ring-4 focus:ring-[#65866d]/10" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-[.85fr_1.15fr]">
                <label className="block"><span className="mb-2 block text-sm font-semibold">How did it go?</span><select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value as CanvassOutcome })} className="w-full rounded-2xl border border-[#ddd7cb] bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-[#65866d] focus:ring-4 focus:ring-[#65866d]/10"><option value="INTERESTED">Interested</option><option value="NOT_HOME">No answer</option><option value="INSPECTED">Inspection done</option><option value="DO_NOT_KNOCK">Do not knock</option></select></label>
                <label className="block"><span className="mb-2 block text-sm font-semibold">A detail to remember <span className="font-normal text-[#89928c]">optional</span></span><input type="text" placeholder="Roof age, hail, next step…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-2xl border border-[#ddd7cb] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#a5aaa3] focus:border-[#65866d] focus:ring-4 focus:ring-[#65866d]/10" /></label>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#eee9e0] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-sm text-xs leading-5 text-[#7e8982]">Only record contact details they choose to share. No inspection or photos without permission.</p>
                <button type="submit" disabled={saving || settingsLoading || !!settingsError || !leadConversionEnabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#d97850] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(172,88,57,.8)] transition hover:bg-[#bf6441] disabled:cursor-not-allowed disabled:bg-[#c9c8c1] disabled:shadow-none">{saving ? 'Saving note…' : 'Save field note'} <span aria-hidden="true">↗</span></button>
              </div>
              {settingsError && <p className="rounded-xl bg-[#fff0eb] p-3 text-xs leading-5 text-[#813c2e]">{settingsError}</p>}
              {!settingsLoading && !settingsError && !leadConversionEnabled && <p className="rounded-xl bg-[#fff6e7] p-3 text-xs leading-5 text-[#76592c]">Canvass lead conversion is off for this workspace. An administrator can change it in workspace settings.</p>}
            </div>
          </form>

          <aside className="space-y-5">
            <section className="rounded-[28px] bg-[#e6ecdf] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6c806a]">In your pocket</p><h2 className="mt-2 font-serif text-2xl">A gentle opener</h2></div><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-lg text-[#55735d]">“</span></div>
              <p className="mt-4 text-sm leading-6 text-[#405747]">&ldquo;{advice.openerScript}&rdquo;</p>
              <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-[#617164]">Need a thoughtful response?</label>
              <select value={selectedObjection} onChange={(e) => setSelectedObjection(e.target.value as ObjectionType)} className="mt-2 w-full rounded-xl border border-[#cdd8c8] bg-white/75 px-3 py-3 text-sm font-medium text-[#31463a] outline-none focus:ring-4 focus:ring-[#65866d]/15"><option value="NO_DAMAGE">“I don’t see any damage.”</option><option value="NEW_ROOF">“My roof is relatively new.”</option><option value="HAVE_ADJUSTER">“I already have an adjuster.”</option><option value="NO_TIME">“I don’t have time.”</option><option value="SEND_EMAIL">“Just send me an email.”</option><option value="SPOUSE">“I need to talk with my spouse.”</option><option value="RATES_GO_UP">“Will my rates go up?”</option></select>
              {advice.objectionResponse && <p className="mt-3 rounded-2xl bg-white/75 p-4 text-sm leading-6 text-[#405747]">&ldquo;{advice.objectionResponse}&rdquo;</p>}
            </section>
            <section className="rounded-[28px] border border-[#e5dfd4] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8a7255]">Keep it grounded</p><h2 className="mt-2 font-serif text-xl">What to notice</h2><ul className="mt-4 space-y-2">{advice.collateralChecklist.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-[#53635a]"><span className="mt-1 text-[#d97850]" aria-hidden="true">•</span><span>{item}</span></li>)}</ul><p className="mt-5 border-t border-[#eee9e0] pt-4 text-xs leading-5 text-[#78847c]">{advice.goldenReportRuleNote}</p></section>
          </aside>
        </div>

        <section className="rounded-[28px] border border-[#e5dfd4] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8a7255]">Workspace CRM</p><h2 className="mt-2 font-serif text-3xl tracking-tight">Recent field leads <span className="font-sans text-base font-medium text-[#8c958f]">{loading ? '…' : leads.length}</span></h2></div><button type="button" onClick={() => router.push('/leads?source=canvass')} className="text-sm font-bold text-[#416a4d] underline decoration-[#bbcab8] underline-offset-4 hover:text-[#254a32]">Open the full list</button></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {!loading && leads.length === 0 && <p className="rounded-2xl border border-dashed border-[#d8d2c6] bg-[#fbfaf7] p-5 text-sm leading-6 text-[#7a867e] md:col-span-2">Your first note will show up here. The field view and workspace CRM share the same leads.</p>}
            {leads.map((lead) => { const outcome = outcomeFromLead(lead); return <button key={lead.id} type="button" onClick={() => router.push(`/leads/${lead.id}`)} className="group rounded-2xl border border-[#ebe6dc] bg-[#fbfaf7] p-4 text-left transition hover:border-[#b6c9b3] hover:bg-[#f6f8f2]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[#293d32]">{lead.address}</p><p className="mt-1 truncate text-sm text-[#79847d]">{lead.name}{lead.phone ? ` · ${lead.phone}` : ''}</p></div><span className="shrink-0 text-xs font-bold text-[#648269] transition group-hover:translate-x-0.5">Open ↗</span></div><div className="mt-4 flex flex-wrap gap-2">{outcome && <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${outcomeColors[outcome]}`}>{outcome.replaceAll('_', ' ')}</span>}<span className="rounded-full bg-[#e9ede6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#586a5d]">{lead.status.replaceAll('_', ' ')}</span></div>{lead.next_action && <p className="mt-3 border-t border-[#ebe6dc] pt-3 text-xs text-[#77847a]">Next: {lead.next_action}</p>}</button> })}
          </div>
        </section>
      </main>
    </div>
  )
}
