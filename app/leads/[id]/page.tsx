'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const STATUSES = ['new', 'assigned', 'qualified', 'inspection_scheduled', 'inspected', 'report_pending', 'report_approved', 'won', 'lost']

type Lead = { id: string; name: string; address: string; status: string; phone: string | null; email: string | null }
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
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const [{ data: leadRow, error: leadError }, activityRes] = await Promise.all([
      supabase.from('leads').select('id,name,address,status,phone,email').eq('id', leadId).maybeSingle(),
      supabase.from('lead_activity').select('id,kind,body,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
    ])
    if (leadError) setError(leadError.message)
    if (!leadRow) setError('Lead not found in this workspace.')
    setLead(leadRow)
    setActivity(activityRes.data ?? [])
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
    const { error: updateError } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (updateError) { setError(updateError.message); setSaving(false); return }
    await supabase.from('lead_activity').insert({ lead_id: lead.id, workspace_id: workspaceId, user_id: user.id, kind: 'status_change', body: `Status changed from ${lead.status} to ${status}` })
    setLead({ ...lead, status })
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
    await supabase.from('leads').update({ status: 'inspection_scheduled', updated_at: new Date().toISOString() }).eq('id', lead.id)
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

  if (!lead && !error) return <p className="p-4 text-sm text-gray-500">Loading lead…</p>
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/leads')} className="text-blue-600 text-sm mb-3">← All leads</button>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {lead && (
        <>
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <p className="text-sm text-gray-600">{lead.address}</p>
            <p className="text-sm text-gray-500 mt-1">{lead.phone || 'No phone'} · {lead.email || 'No email'}</p>
            <select aria-label="Lead status" value={lead.status} disabled={saving} onChange={(e) => void updateStatus(e.target.value)} className="mt-3 border rounded px-2 py-1 text-sm">
              {STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
            <div className="flex gap-2 mt-3">
              <a className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Navigate</a>
              {lead.phone && <a className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded" href={`tel:${lead.phone}`}>Call</a>}
            </div>
          </div>
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
