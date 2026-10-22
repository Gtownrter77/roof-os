'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import { CANVASS_OBJECTIONS, getCanvassAdvice, ObjectionType } from '../../lib/ai/canvass-mentor'
import {
  draftBestReturnTime,
  draftDailySummary,
  draftFollowUpDate,
  draftHailOverlay,
  draftLeadScoreAfter,
  draftLeadScoreBefore,
  draftMultiTradeFlag,
  draftNextDoor,
  draftOpenerScript,
  draftPhoneFromNotes,
  draftPinToEstimate,
  draftSms,
  draftStormZoneTurf,
  draftColorPins,
  draftCoachingTip,
  draftEmail,
  draftGoodBetterBest,
  draftHardStopHostile,
  CANVASS_125_CATALOG,
  CANVASS_OPTIONS,
  draftDispositionOptions,
  draftLossReasonOptions,
  draftYoyoReturn,
  draftWorkflowStage,
} from '../../lib/ai/canvass125'
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
  const [aiQuery, setAiQuery] = useState('')
  const [voiceNote, setVoiceNote] = useState('')
  const [yoloOpen, setYoloOpen] = useState(false)
  const [yoloFree, setYoloFree] = useState(false)
  const [yoloPin, setYoloPin] = useState('')
  const [yoloReveal, setYoloReveal] = useState(false)

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

  const scoreBefore = draftLeadScoreBefore({
    hailInches: /hail|storm/i.test(form.notes) ? 1 : 0,
    roofAge: /old|aged|15|20/i.test(form.notes) ? 18 : 10,
    newHomeowner: /new owner|just bought/i.test(form.notes),
    noSoliciting: /no solicit|do not knock/i.test(form.notes),
  })
  const scoreAfter = draftLeadScoreAfter(form.outcome, form.notes)
  const hail = draftHailOverlay(/hail|storm/i.test(form.notes) ? 1 : 0)
  const stormTurf = draftStormZoneTurf(hail.inches)
  const opener = draftOpenerScript(/\d{4}-\d{2}-\d{2}/.exec(form.notes)?.[0])
  const nextDoor = draftNextDoor(form.address, leads.map((lead) => lead.address).filter(Boolean))
  const sms = draftSms(form.homeownerName, form.address)
  const followUp = draftFollowUpDate(form.outcome)
  const multi = draftMultiTradeFlag(form.notes)
  const phone = draftPhoneFromNotes(form.notes)
  const returnWindow = draftBestReturnTime(form.notes)
  const estimateLink = draftPinToEstimate(form.address || 'address')
  const summary = draftDailySummary(leads.length, leads.filter((lead) => outcomeFromLead(lead) === 'INTERESTED').length)
  const pin = draftColorPins(form.outcome)
  const coach = draftCoachingTip(form.outcome)
  const email = draftEmail(form.homeownerName, form.address)
  const tiers = draftGoodBetterBest()
  const hostile = draftHardStopHostile(form.notes)
  const dispositions = draftDispositionOptions()
  const lossReasons = draftLossReasonOptions()
  const stage = draftWorkflowStage(form.outcome)
  const yoyo = draftYoyoReturn(leads.filter((lead) => outcomeFromLead(lead) === 'NOT_HOME').map((lead) => lead.address))
  const catalog = CANVASS_125_CATALOG.filter((item) => item.name.toLowerCase().includes(aiQuery.toLowerCase()) || item.group.toLowerCase().includes(aiQuery.toLowerCase()))
  const mapPins = leads.slice(0, 12).map((lead, index) => ({
    lead,
    color: draftColorPins(outcomeFromLead(lead) || 'INTERESTED').color,
    x: 18 + (index % 4) * 22,
    y: 22 + Math.floor(index / 4) * 24,
  }))

  function startVoice() {
    const w = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceNote('Voice not available in this browser')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.onresult = (event: any) => {
      const said = event.results[0][0].transcript as string
      setVoiceNote(said)
      setForm((current) => ({ ...current, notes: [current.notes, said].filter(Boolean).join(' — ') }))
    }
    rec.start()
  }

  function loadWebYolo() {
    try {
      const raw = localStorage.getItem('roofos.yolo.v1')
      const flags = raw ? JSON.parse(raw) : {}
      setYoloOpen(Boolean(flags.unlocked))
      setYoloFree(Boolean(flags.unlocked && (flags.freeCanvass || flags.freeAll)))
    } catch {
      setYoloOpen(false)
      setYoloFree(false)
    }
  }

  function unlockWebYolo() {
    const stored = localStorage.getItem('roofos.yolo.pin') || ''
    if (!stored) {
      if (yoloPin.length < 4) return
      localStorage.setItem('roofos.yolo.pin', yoloPin)
    } else if (yoloPin !== stored) {
      setNotice('Wrong owner PIN')
      return
    }
    const flags = { unlocked: true, freeCanvass: true, freeAll: true }
    localStorage.setItem('roofos.yolo.v1', JSON.stringify(flags))
    setYoloPin('')
    loadWebYolo()
  }
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
                if (!hardStopActive) setSelectedObjection(e.target.value as ObjectionType)
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
            ) : ['NOT_INTERESTED', 'DONT_WANT_SALES', 'DO_NOT_SOLICIT'].includes(selectedObjection) ? (
              <div className="p-3 bg-red-950/80 border-2 border-red-500 text-white rounded mt-2 font-bold">
                If this is what the homeowner just said, press the red hard-stop button below. Do not counter, persuade, or ask for another chance. Selecting a training example alone does not log a real-world event.
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

        {yoloOpen && <section className="glass rounded-xl p-4 border border-red-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">YOLO · all AI drafts</h2>
            <span className="text-[10px] uppercase tracking-wide text-red-300">{yoloFree ? "FREE" : "LOCKED"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-white/10 p-2">
              <p className="text-slate-400">Score before door</p>
              <p className="font-black text-lg">{scoreBefore.score}</p>
              <p className="text-[10px] text-slate-300">{scoreBefore.reasons.join(', ') || 'base'}</p>
              <p className="text-[10px] text-cyan-200">{scoreBefore.next}</p>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="text-slate-400">Score after talk</p>
              <p className="font-black text-lg">{scoreAfter.score}</p>
              <p className="text-[10px] text-slate-300">{scoreAfter.reasons.join(', ')}</p>
              <p className="text-[10px] text-cyan-200">{scoreAfter.next}</p>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="text-slate-400">Storm turf</p>
              <p className="font-bold">{stormTurf.priority} · {hail.band}</p>
              <p className="text-[10px] text-slate-300">{stormTurf.reason}</p>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="text-slate-400">Today</p>
              <p className="font-bold">{summary.doors} doors / {summary.rate}%</p>
              <p className="text-[10px] text-slate-300">{summary.reason}</p>
            </div>
          </div>

          <div className="rounded border border-white/10 p-2">
            <p className="text-[10px] uppercase text-slate-400 mb-1">Turf pins</p>
            <svg viewBox="0 0 100 80" className="w-full h-28 bg-slate-900/60 rounded">
              {mapPins.map((pin) => (
                <g key={pin.lead.id}>
                  <circle cx={pin.x} cy={pin.y} r="3.2" fill={pin.color} />
                  <text x={pin.x + 4} y={pin.y + 1} fontSize="3" fill="#e2e8f0">{pin.lead.address.slice(0, 12)}</text>
                </g>
              ))}
              {mapPins.length === 0 && <text x="8" y="40" fontSize="4" fill="#94a3b8">No knocks yet</text>}
            </svg>
            <p className="text-[10px] text-slate-400 mt-1">Current pin: {pin.label}</p>
          </div>

          <div className="rounded border border-white/10 p-2 space-y-1">
            <p className="text-[10px] uppercase text-slate-400">At the door</p>
            <p className="text-xs text-cyan-100">{opener.script}</p>
            <p className="text-xs text-slate-300">Next: {nextDoor.next || 'none queued'} — {nextDoor.next ? nextDoor.reason : 'add an address'}</p>
            <p className="text-xs text-slate-300">Return {returnWindow.window} · follow-up in {followUp.inDays}d · multi-trade: {multi.yes ? multi.trades.join(', ') : 'roof only'}</p>
            <p className="text-xs text-amber-200">{coach.tip}</p>
            {hostile.stop && <p className="text-xs text-red-300 font-bold">{hostile.reason}. {hostile.next}</p>}
            {phone.phone && <p className="text-xs text-emerald-200">Phone from notes: {phone.phone}</p>}
          </div>

          <div className="rounded border border-white/10 p-2 space-y-1">
            <p className="text-[10px] uppercase text-slate-400">SMS draft</p>
            <p className="text-xs">{sms.text}</p>
            <p className="text-[10px] text-slate-400">{sms.next}</p>
          </div>
          <div className="rounded border border-white/10 p-2 space-y-1">
            <p className="text-[10px] uppercase text-slate-400">Email draft</p>
            <p className="text-xs font-bold">{email.subject}</p>
            <p className="text-xs whitespace-pre-line">{email.body}</p>
          </div>
          <p className="text-xs text-slate-300">Tiers: {tiers.tiers.join(' · ')}</p>
          <div className="rounded border border-white/10 p-2 space-y-1">
            <p className="text-[10px] uppercase text-slate-400">REA options — SalesRabbit / SPOTIO / JobNimbus</p>
            <p className="text-[11px]">Stage: {stage.stage}</p>
            <p className="text-[11px]">Yo-yo return: {yoyo.doors.length} not-home doors at {yoyo.window}</p>
            <p className="text-[10px] text-slate-300">Dispositions: {dispositions.options.slice(0, 8).join(', ')}…</p>
            <p className="text-[10px] text-slate-300">Loss reasons: {lossReasons.options.join(', ')}</p>
            <p className="text-[10px] text-slate-400">Filters: {CANVASS_OPTIONS.filters.join(' · ')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startVoice} className="rounded bg-white text-black text-[11px] font-bold px-2 py-1">Voice log</button>
            <button type="button" onClick={() => setForm((current) => ({ ...current, notes: [current.notes, sms.text].filter(Boolean).join(' — ') }))} className="rounded bg-cyan-400 text-black text-[11px] font-bold px-2 py-1">Use SMS draft</button>
            <button type="button" onClick={() => router.push(estimateLink.href)} className="rounded border border-cyan-400/40 text-cyan-100 text-[11px] font-bold px-2 py-1">Pin → estimate</button>
          </div>
          {voiceNote && <p className="text-[11px] text-emerald-200">Heard: {voiceNote}</p>}

          <div className="space-y-1">
            <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Search all 125 drafts" className="w-full p-2 border rounded text-xs" />
            <div className="max-h-36 overflow-auto space-y-1">
              {catalog.slice(0, 20).map((item) => (
                <div key={item.id} className="flex justify-between text-[11px] border border-white/10 rounded px-2 py-1">
                  <span>{item.name}</span>
                  <span className="text-slate-400">{item.group}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">{catalog.length} of {CANVASS_125_CATALOG.length} drafts. {yoloFree ? "YOLO free — drafts can apply." : "Unlock free canvass to apply."}</p>
          </div>
        </section>}

        <button type="button" onDoubleClick={() => { setYoloReveal(true); loadWebYolo() }} className="h-2 w-full" aria-label="owner" />
        {yoloReveal && !yoloOpen && (
          <div className="rounded border border-red-500/40 p-2 space-y-2">
            <p className="text-[10px] uppercase text-red-300">Owner PIN — unlocks all AI</p>
            <input type="password" value={yoloPin} onChange={(e) => setYoloPin(e.target.value)} placeholder="PIN" className="w-full p-2 border rounded text-xs" />
            <button type="button" onClick={unlockWebYolo} className="rounded bg-red-700 text-white text-[11px] font-bold px-2 py-1">Unlock YOLO</button>
          </div>
        )}
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
