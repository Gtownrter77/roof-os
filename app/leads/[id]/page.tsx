'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const STATUSES = ['new', 'assigned', 'qualified', 'inspection_scheduled', 'inspected', 'report_pending', 'report_approved', 'won', 'lost']
const LOST_REASONS = [
  ['price', 'Price'],
  ['no_response', 'No response'],
  ['competitor', 'Competitor'],
  ['insurance_denied', 'Insurance denied'],
  ['customer_canceled', 'Customer canceled'],
  ['outside_service_area', 'Outside service area'],
  ['duplicate', 'Duplicate'],
  ['bad_lead', 'Bad lead'],
  ['other', 'Other'],
] as const

type Lead = {
  id: string
  name: string
  address: string
  status: string
  phone: string | null
  email: string | null
  source?: string | null
  next_action: string | null
  next_action_due: string | null
  next_action_owner_id: string | null
  lead_score: number
  lead_score_reasons: string[]
  lost_reason: string | null
  lost_reason_detail: string | null
  last_activity_at: string | null
}
type Activity = { id: string; kind: string; body: string; created_at: string }

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const leadId = params.id
  const [lead, setLead] = useState<Lead | null>(null)
  const [activity, setActivity] = useState<Activity[]>([])
  const [note, setNote] = useState('')
  const [apptAt, setApptAt] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDue, setNextActionDue] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [lostDetail, setLostDetail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const [{ data: leadRow, error: leadError }, activityRes] = await Promise.all([
      supabase.from('leads').select('id,name,address,status,phone,email,source,next_action,next_action_due,next_action_owner_id,lead_score,lead_score_reasons,lost_reason,lost_reason_detail,last_activity_at').eq('id', leadId).maybeSingle(),
      supabase.from('lead_activity').select('id,kind,body,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
    ])
    if (leadError) setError(leadError.message)
    if (!leadRow) setError('Lead not found in this workspace.')
    setLead(leadRow)
    setActivity(activityRes.data ?? [])
    if (leadRow) {
      setNextAction(leadRow.next_action ?? '')
      setNextActionDue(leadRow.next_action_due ? new Date(leadRow.next_action_due).toISOString().slice(0, 16) : '')
      setLostReason(leadRow.lost_reason ?? '')
      setLostDetail(leadRow.lost_reason_detail ?? '')
    }
  }

  useEffect(() => { void load() }, [leadId])

  async function ctx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    return { user, workspaceId }
  }

  async function updateStatus(status: string) {
    if (!lead) return
    setSaving(true); setError('')
    const { user, workspaceId } = await ctx()
    if (!user || !workspaceId) { setError('No workspace available.'); setSaving(false); return }
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'qualified' && lead.status !== 'qualified') payload.qualified_at = new Date().toISOString()
    if (status === 'lost') payload.lost_at = new Date().toISOString()
    if (status !== 'lost') {
      payload.lost_reason = null
      payload.lost_reason_detail = null
      payload.lost_at = null
    }
    const { error: updateError } = await supabase.from('leads').update(payload).eq('id', lead.id)
    if (updateError) { setError(updateError.message); setSaving(false); return }
    await supabase.from('lead_activity').insert({ lead_id: lead.id, workspace_id: workspaceId, user_id: user.id, kind: 'status_change', body: `Status changed from ${lead.status} to ${status}` })
    await load()
    setSaving(false)
  }

  async function saveNextAction() {
    if (!lead) return
    setSaving(true); setError('')
    const { user, workspaceId } = await ctx()
    if (!user || !workspaceId) { setError('No workspace available.'); setSaving(false); return }
    const due = nextActionDue ? new Date(nextActionDue).toISOString() : null
    const { error: updateError } = await supabase.from('leads').update({
      next_action: nextAction.trim() || null,
      next_action_due: due,
      next_action_owner_id: nextAction.trim() ? user.id : null,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)
    if (updateError) setError(updateError.message)
    else await supabase.from('lead_activity').insert({ lead_id: lead.id, workspace_id: workspaceId, user_id: user.id, kind: 'note', body: nextAction.trim() ? `Next action set: ${nextAction.trim()}${due ? ` due ${new Date(due).toLocaleString()}` : ''}` : 'Next action cleared.' })
    await load()
    setSaving(false)
  }

  async function saveLostReason() {
    if (!lead || lead.status !== 'lost') return
    setSaving(true); setError('')
    const { user, workspaceId } = await ctx()
    if (!user || !workspaceId) { setError('No workspace available.'); setSaving(false); return }
    const { error: updateError } = await supabase.from('leads').update({
      lost_reason: lostReason || null,
      lost_reason_detail: lostDetail.trim() || null,
      lost_at: lead.lost_reason ? undefined : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)
    if (updateError) setError(updateError.message)
    else await supabase.from('lead_activity').insert({ lead_id: lead.id, workspace_id: workspaceId, user_id: user.id, kind: 'note', body: `Lost reason recorded: ${lostReason || 'unspecified'}${lostDetail.trim() ? ` — ${lostDetail.trim()}` : ''}` })
    await load()
    setSaving(false)
  }

  async function addNote() {
    if (!note.trim() || !lead) return
    setSaving(true)
    const { user, workspaceId } = await ctx()
    if (!user || !workspaceId) { setError('No workspace available.'); setSaving(false); return }
    const { error: insertError } = await supabase.from('lead_activity').insert({ lead_id: lead.id, workspace_id: workspaceId, user_id: user.id, kind: 'note', body: note.trim() })
    if (insertError) setError(insertError.message)
    else setNote('')
    await load()
    setSaving(false)
  }

  async function scheduleInspection() {
    if (!lead || !apptAt) return
    setSaving(true); setError('')
    const { user, workspaceId } = await ctx()
    if (!user || !workspaceId) { setError('No workspace available.'); setSaving(false); return }
    const start = new Date(apptAt)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const { error: insertError } = await supabase.from('appointments').insert({ workspace_id: workspaceId, lead_id: lead.id, title: `Inspection: ${lead.name}`, appointment_type: 'inspection', starts_at: start.toISOString(), ends_at: end.toISOString(), location: lead.address, created_by: user.id })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    await supabase.from('leads').update({ status: 'inspection_scheduled', next_action: 'Complete inspection', next_action_due: start.toISOString(), next_action_owner_id: user.id, updated_at: new Date().toISOString() }).eq('id', lead.id)
    setApptAt('')
    await load()
    setSaving(false)
  }

  async function startInspection() {
    if (!lead) return
    setSaving(true)
    const { user, workspaceId } = await ctx()
    if (!user || !workspaceId) { setError('No workspace available.'); setSaving(false); return }
    const { data, error: insertError } = await supabase.from('inspection_sessions').insert({ workspace_id: workspaceId, lead_id: lead.id, created_by: user.id, status: 'in_progress' }).select('id').single()
    if (insertError) { setError(insertError.message); setSaving(false); return }
    router.push(`/camera?inspection=${data.id}&lead=${lead.id}`)
  }

  const scoreLabel = useMemo(() => {
    if (!lead) return ''
    if (lead.status === 'lost') return 'Lost'
    if (lead.lead_score >= 70) return 'Hot'
    if (lead.lead_score >= 40) return 'Warm'
    return 'Cold'
  }, [lead])

  if (!lead && !error) return <p className="p-4 text-sm text-gray-500">Loading lead…</p>
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/leads')} className="text-blue-600 text-sm mb-3">← All leads</button>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {lead && (
        <>
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between gap-3">
              <div><h1 className="text-2xl font-bold">{lead.name}</h1><p className="text-sm text-gray-600">{lead.address}</p></div>
              <div className="text-right"><div className="text-lg font-bold">{lead.lead_score}/100</div><div className="text-xs text-gray-500">{scoreLabel}</div></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">{lead.phone || 'No phone'} · {lead.email || 'No email'}</p>
            <select aria-label="Lead status" value={lead.status} disabled={saving} onChange={(e) => void updateStatus(e.target.value)} className="mt-3 border rounded px-2 py-1 text-sm">
              {STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-2">Score is deterministic and explainable: {lead.lead_score_reasons?.join(' · ') || 'No score factors yet.'}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <a className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Navigate</a>
              {lead.phone && <a className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded" href={`tel:${lead.phone}`}>Call</a>}
              <button onClick={() => router.push(`/ready/${lead.id}`)} className="text-xs bg-gray-900 text-white px-2 py-1 rounded">Job ready?</button>
              <button onClick={() => router.push(`/passport/${lead.id}`)} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">Roof Passport</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="font-semibold mb-2">Next action</h2>
            <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="What must happen next?" className="w-full border rounded p-2 text-sm" />
            <input type="datetime-local" value={nextActionDue} onChange={(e) => setNextActionDue(e.target.value)} className="w-full border rounded p-2 text-sm mt-2" />
            <button disabled={saving} onClick={() => void saveNextAction()} className="w-full bg-gray-900 text-white py-2 rounded font-semibold mt-2 disabled:opacity-60">Save next action</button>
          </div>

          {lead.status === 'lost' && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="font-semibold mb-2">Lost reason</h2>
              <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="w-full border rounded p-2 text-sm">
                <option value="">Select reason</option>
                {LOST_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea value={lostDetail} onChange={(e) => setLostDetail(e.target.value)} placeholder="Optional detail" rows={3} className="w-full border rounded p-2 text-sm mt-2" />
              <button disabled={saving || !lostReason} onClick={() => void saveLostReason()} className="w-full bg-red-700 text-white py-2 rounded font-semibold mt-2 disabled:opacity-60">Save lost reason</button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-2">
            <h2 className="font-semibold">Schedule inspection</h2>
            <input type="datetime-local" value={apptAt} onChange={(e) => setApptAt(e.target.value)} className="w-full border rounded p-2 text-sm" />
            <button disabled={saving || !apptAt} onClick={() => void scheduleInspection()} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-60">Save on calendar</button>
            <button disabled={saving} onClick={() => void startInspection()} className="w-full bg-gray-900 text-white py-2 rounded font-semibold disabled:opacity-60">Start inspection now</button>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-2">Activity</h2>
            <div className="flex gap-2 mb-3">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" className="flex-1 border rounded p-2 text-sm" />
              <button disabled={saving || !note.trim()} onClick={() => void addNote()} className="bg-gray-800 text-white px-3 rounded text-sm">Add</button>
            </div>
            {activity.map((item) => <div key={item.id} className="text-xs bg-gray-50 rounded p-2 mb-2"><span className="font-semibold">{item.kind.replace('_', ' ')}</span> · {item.body}</div>)}
          </div>
        </>
      )}
    </div>
  )
}
