'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import { CANVASS_OBJECTIONS, getCanvassAdvice, ObjectionType } from '../../lib/ai/canvass-mentor'
import {
  CANVASS_LEAD_SOURCE,
  CanvassOutcome,
  canvassOutcomeToLeadFields,
  normalizeAddress,
} from '../../lib/canvass'

type CanvassLead = {
  id: string
  name: string
  address: string
  status: string
  phone: string | null
  next_action: string | null
  last_activity_at: string | null
  updated_at?: string | null
}

const outcomeColors: Record<CanvassOutcome, string> = {
  INTERESTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  INSPECTED: 'bg-blue-100 text-cyan-200 border-blue-300',
  NOT_HOME: 'bg-amber-100 text-amber-800 border-amber-300',
  DO_NOT_KNOCK: 'bg-red-100 text-red-800 border-red-300',
}

function outcomeFromLead(lead: CanvassLead): CanvassOutcome | null {
  if (lead.status === 'lost') return 'DO_NOT_KNOCK'
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
  const [hardStopActive, setHardStopActive] = useState(false)
  const [hardStopReason, setHardStopReason] = useState('')

  function playHardStopAlarm() {
    try {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) return
      const context = new AudioContextConstructor()
      const duration = 0.9
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * 0.8
      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      source.buffer = buffer
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2400, context.currentTime)
      filter.frequency.exponentialRampToValueAtTime(450, context.currentTime + duration)
      gain.gain.setValueAtTime(0.001, context.currentTime)
      gain.gain.linearRampToValueAtTime(0.22, context.currentTime + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)
      source.onended = () => { void context.close() }
      source.start()
      source.stop(context.currentTime + duration)
    } catch {
      // The visual hard stop remains active if browser audio is unavailable.
    }
  }

  function triggerHardStop(reason = 'Homeowner said no') {
    setHardStopActive(true)
    setHardStopReason(reason)
    setForm((current) => ({
      ...current,
      outcome: 'DO_NOT_KNOCK',
      notes: [current.notes.trim(), 'HARD STOP: ' + reason + '. End the interaction immediately; do not continue pitching.'].filter(Boolean).join(' — '),
    }))
    playHardStopAlarm()
  }
  const [selectedObjection, setSelectedObjection] = useState<ObjectionType>('NO_DAMAGE')
  const [showVCard, setShowVCard] = useState(false)
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
      .select('id,name,address,status,phone,next_action,last_activity_at,updated_at')
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

  async function logKnock(e: FormEvent) {
    e.preventDefault()
    const address = form.address.trim()
    if (!address) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/canvass')
        return
      }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) {
        setError('Active workspace is required to log canvass activity.')
        return
      }

      const recordedOutcome: CanvassOutcome = hardStopActive ? 'DO_NOT_KNOCK' : form.outcome
      const fields = canvassOutcomeToLeadFields(recordedOutcome)
      const name = form.homeownerName.trim() || `Canvass: ${address}`
      const phone = form.phone.trim() || null
      const noteBody = [
        hardStopActive ? `CONDUCT EVENT: HARD STOP — ${hardStopReason}` : null,
        `Door knock: ${recordedOutcome.replaceAll('_', ' ')}`,
        form.notes.trim() ? form.notes.trim() : null,
      ].filter(Boolean).join(' — ')

      const normalized = normalizeAddress(address)
      const { data: existingRows } = await supabase
        .from('leads')
        .select('id,address,source')
        .eq('workspace_id', workspaceId)
        .eq('source', CANVASS_LEAD_SOURCE)
        .limit(200)

      const existing = (existingRows ?? []).find(
        (row) => normalizeAddress(row.address || '') === normalized,
      )

      let leadId = existing?.id as string | undefined

      if (leadId) {
        const updatePayload: Record<string, unknown> = {
          status: fields.status,
          next_action: fields.next_action,
          next_action_owner_id: fields.next_action ? user.id : null,
          lost_reason: fields.lost_reason,
          lost_reason_detail: fields.lost_reason_detail,
          lost_at: fields.lost_at,
          updated_at: new Date().toISOString(),
        }
        if (form.homeownerName.trim()) updatePayload.name = name
        if (phone) updatePayload.phone = phone
        const { error: updateError } = await supabase.from('leads').update(updatePayload).eq('id', leadId)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { data: inserted, error: insertError } = await supabase.from('leads').insert({
          name,
          address,
          phone,
          source: CANVASS_LEAD_SOURCE,
          notes: form.notes.trim() || 'Logged from field canvass.',
          owner_id: user.id,
          workspace_id: workspaceId,
          status: fields.status,
          next_action: fields.next_action,
          next_action_owner_id: fields.next_action ? user.id : null,
          lost_reason: fields.lost_reason,
          lost_reason_detail: fields.lost_reason_detail,
          lost_at: fields.lost_at,
        }).select('id').single()

        if (insertError || !inserted) {
          setError(insertError?.message || 'Could not create canvass lead.')
          return
        }
        leadId = inserted.id
      }

      const { error: activityError } = await supabase.from('lead_activity').insert({
        lead_id: leadId,
        workspace_id: workspaceId,
        user_id: user.id,
        kind: 'note',
        body: noteBody,
      })

      setForm({ address: '', homeownerName: '', phone: '', outcome: 'INTERESTED', notes: '' })
      setHardStopActive(false)
      setHardStopReason('')
      if (activityError) {
        setError(`Lead saved, but the CRM activity log failed: ${activityError.message}`)
        setNotice(hardStopActive
          ? 'Do not continue canvassing this homeowner. The lead status was saved, but the hard-stop event was not confirmed in activity history.'
          : (existing ? 'Lead updated, but the activity note was not saved.' : 'Lead saved, but the activity note was not saved.'))
      } else {
        setNotice(hardStopActive
          ? 'Hard stop recorded in CRM activity. Interaction closed; do not continue canvassing this homeowner.'
          : (existing ? 'Updated existing canvass lead.' : 'Saved to Leads (canvass source).'))
      }
      await loadCanvassLeads()
    } catch {
      setError('Failed to save canvass knock into Leads.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center min-w-0">
            <button type="button" onClick={() => smartBack(router, '/leads')} className="mr-3 text-xl text-cyan-300">←</button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">Field canvass</h1>
              <p className="text-[11px] text-slate-400">Door-knock mode for Leads — same CRM, field UI</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => router.push('/leads?source=canvass')}
              className="rounded border border-cyan-400/40 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10"
            >
              Canvass leads
            </button>
            <button
              type="button"
              onClick={() => setShowVCard(!showVCard)}
              className="bg-emerald-400 text-black text-xs font-bold px-2.5 py-1 rounded uppercase hover:bg-emerald-300"
            >
              VCard
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-lg text-xs font-bold">{notice}</div>}
        {hardStopActive && (
          <section role="alert" aria-live="assertive" className="rounded-xl border-4 border-red-600 bg-red-950 p-4 text-white">
            <h2 className="text-xl font-black uppercase">HARD STOP — DISENGAGE NOW</h2>
            <p className="mt-1 font-bold">{hardStopReason}. Stop pitching, apologize if appropriate, and leave respectfully. Do not try to overcome this refusal.</p>
            <p className="mt-2 text-xs">This event will be logged with the lead when you save. No camera or microphone is used.</p>
          </section>
        )}
        {error && <div className="bg-red-400/10 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-bold" role="alert">{error}</div>}

        {showVCard && (
          <div className="glass rounded-xl p-4 border-2 border-emerald-500 space-y-3">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <p className="font-bold text-base text-white">Business card not configured</p>
                <p className="text-xs text-slate-300">Connect verified company contact details before sharing.</p>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">Not configured</span>
            </div>
          </div>
        )}

        <div className="glass rounded-xl p-4 border-l-4 border-indigo-600 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-sm text-white">Doorstep opener & objection guide</h2>
            <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded uppercase">Golden rule</span>
          </div>
          <div className="bg-indigo-50/60 p-3 rounded border border-indigo-100 space-y-1 text-xs">
            <p className="font-bold text-indigo-950">Suggested opener:</p>
            <p className="text-indigo-900 italic">&ldquo;{advice.openerScript}&rdquo;</p>
          </div>
          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-100 block">Homeowner objection</label>
            <select
              value={selectedObjection}
              disabled={hardStopActive}
              onChange={(e) => {
                const nextObjection = e.target.value as ObjectionType
                if (['NOT_INTERESTED', 'DONT_WANT_SALES', 'DO_NOT_SOLICIT'].includes(nextObjection)) {
                  const reason = nextObjection === 'DO_NOT_SOLICIT'
                    ? 'No-soliciting sign or request to leave'
                    : nextObjection === 'DONT_WANT_SALES'
                      ? 'Homeowner declined a sales pitch'
                      : 'Homeowner said not interested'
                  triggerHardStop(reason)
                } else if (!hardStopActive) {
                  setSelectedObjection(nextObjection)
                }
              }}
              className="w-full p-2 border rounded font-semibold text-xs"
            >
              {Array.from(new Set(CANVASS_OBJECTIONS.map((item) => item.category))).map((category) => (
                <optgroup key={category} label={category}>
                  {CANVASS_OBJECTIONS.filter((item) => item.category === category).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {hardStopActive ? (
              <div role="alert" className="p-3 bg-red-950 border-2 border-red-500 text-white rounded mt-2 font-bold">
                Respect the refusal. Do not counter, persuade, or ask for another chance. End the interaction and leave.
              </div>
            ) : advice.objectionResponse && (
              <div className="p-3 bg-amber-400/10 border border-amber-400/30 text-amber-100 rounded mt-2 font-medium">
                <p className="font-bold text-[11px] uppercase text-amber-800 mb-0.5">Suggested response — never override a refusal</p>
                <p>&ldquo;{advice.objectionResponse}&rdquo;</p>
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-400 border-t pt-2 space-y-1">
            <p className="font-bold text-slate-200">Soft-metal evidence checklist</p>
            <div className="flex flex-wrap gap-1">
              {advice.collateralChecklist.map((item) => (
                <span key={item} className="bg-white/10 text-slate-100 px-2 py-0.5 rounded border">{item}</span>
              ))}
            </div>
            <p className="text-cyan-200 font-semibold pt-1">{advice.goldenReportRuleNote}</p>
          </div>
        </div>

        <form onSubmit={(e) => void logKnock(e)} className="glass rounded-xl p-4 space-y-3 border">
          <h2 className="font-bold text-sm text-slate-100">Log door knock → Leads</h2>
          <button type="button" onClick={() => triggerHardStop()} disabled={hardStopActive || saving} className="w-full rounded-lg border-2 border-red-500 bg-red-700 px-3 py-3 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60">
            {hardStopActive ? 'Hard stop active — save event' : 'Homeowner said no — HARD STOP'}
          </button>
          <input
            type="text"
            required
            placeholder="Property address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full p-2.5 border rounded-lg text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Homeowner name (optional)"
              value={form.homeownerName}
              onChange={(e) => setForm({ ...form, homeownerName: e.target.value })}
              className="p-2.5 border rounded-lg text-sm"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="p-2.5 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.outcome}
              disabled={hardStopActive}
              onChange={(e) => {
                const nextOutcome = e.target.value as CanvassOutcome
                if (nextOutcome === 'DO_NOT_KNOCK') triggerHardStop('Do not knock / no soliciting request')
                else if (!hardStopActive) setForm({ ...form, outcome: nextOutcome })
              }}
              className="p-2.5 border rounded-lg text-sm font-semibold"
            >
              <option value="INTERESTED">Interested / inspection requested</option>
              <option value="NOT_HOME">Not home / left door hanger</option>
              <option value="INSPECTED">On-site inspection completed</option>
              <option value="DO_NOT_KNOCK">Do not knock / no soliciting</option>
            </select>
            <input
              type="text"
              placeholder="Notes (hail, roof age, etc.)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="p-2.5 border rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to Leads'}
          </button>
        </form>

        <div className="glass rounded-xl p-4 space-y-3">
          <h2 className="font-bold text-sm text-slate-100 flex justify-between items-center">
            <span>Canvass leads ({loading ? '…' : leads.length})</span>
            <span className="text-xs text-slate-400 font-normal">Live from workspace CRM</span>
          </h2>
          <div className="space-y-2">
            {!loading && leads.length === 0 && (
              <p className="rounded border border-dashed p-4 text-xs text-slate-400">
                No canvass leads yet. Log a door knock — it creates (or updates) a lead with source canvass.
              </p>
            )}
            {leads.map((lead) => {
              const outcome = outcomeFromLead(lead)
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="w-full p-3 border rounded-lg bg-white/5 flex justify-between items-start text-xs border-l-4 border-blue-600 text-left hover:bg-white/10"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white truncate">{lead.address}</span>
                      {outcome && (
                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] border ${outcomeColors[outcome]}`}>
                          {outcome.replaceAll('_', ' ')}
                        </span>
                      )}
                      <span className="rounded bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                        {lead.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="text-slate-200">{lead.name}{lead.phone ? ` · ${lead.phone}` : ''}</p>
                    {lead.next_action && <p className="text-slate-400">Next: {lead.next_action}</p>}
                  </div>
                  <span className="text-cyan-300 shrink-0 ml-2">Open →</span>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
