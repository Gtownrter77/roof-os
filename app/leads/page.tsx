'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const statuses = ['new', 'assigned', 'qualified', 'inspection_scheduled', 'inspected', 'report_pending', 'report_approved', 'won', 'lost']
type Lead = { id: string; name: string; address: string; status: string; phone?: string | null; email?: string | null }
type Activity = { id: string; kind: string; body: string; created_at: string }

export default function LeadsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [activity, setActivity] = useState<Record<string, Activity[]>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')

  useEffect(() => {
    let active = true
    async function loadLeads() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const { data, error: queryError } = await supabase.from('leads').select('id,name,address,status,phone,email').order('created_at', { ascending: false })
      if (!active) return
      if (queryError) setError(queryError.message)
      else setLeads(data ?? [])
      setLoading(false)
    }
    loadLeads()
    return () => { active = false }
  }, [router, supabase])

  async function loadActivity(leadId: string) {
    setExpanded(leadId)
    const { data, error: queryError } = await supabase.from('lead_activity').select('id,kind,body,created_at').eq('lead_id', leadId).order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setActivity((current) => ({ ...current, [leadId]: data ?? [] }))
  }

  async function updateStatus(lead: Lead, status: string) {
    setSaving(lead.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const { error: updateError } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (updateError) setError(updateError.message)
    else {
      await supabase.from('lead_activity').insert({ lead_id: lead.id, workspace_id: (await supabase.rpc('current_workspace_id')).data, user_id: user.id, kind: 'status_change', body: `Status changed from ${lead.status} to ${status}` })
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status } : item))
      await loadActivity(lead.id)
    }
    setSaving('')
  }

  async function addNote(leadId: string) {
    const body = notes[leadId]?.trim()
    if (!body) return
    setSaving(leadId)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace is available for this account.'); setSaving(''); return }
    const { error: insertError } = await supabase.from('lead_activity').insert({ lead_id: leadId, workspace_id: workspaceId, user_id: user.id, kind: 'note', body })
    if (insertError) setError(insertError.message)
    else { setNotes((current) => ({ ...current, [leadId]: '' })); await loadActivity(leadId) }
    setSaving('')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="flex items-center justify-between mb-4"><div><button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button><h1 className="text-2xl font-bold">👤 Leads</h1></div><button onClick={() => router.push('/leads/new')} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">+ New lead</button></div>
      {loading && <p className="text-sm text-gray-500">Loading leads…</p>}
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      {!loading && !error && leads.length === 0 && <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No leads yet. Add your first lead to get started.</div>}
      {leads.map((lead) => <div key={lead.id} className="bg-white rounded-lg shadow p-4 mb-3"><div className="flex justify-between gap-3"><div><p className="font-semibold">{lead.name}</p><p className="text-sm text-gray-500">{lead.address}</p></div><select aria-label={`Status for ${lead.name}`} value={lead.status} disabled={saving === lead.id} onChange={(event) => updateStatus(lead, event.target.value)} className="h-8 text-xs border rounded px-1">{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div><button onClick={() => expanded === lead.id ? setExpanded(null) : loadActivity(lead.id)} className="text-blue-600 text-xs mt-3">{expanded === lead.id ? 'Hide activity' : 'View activity & add note'}</button>{expanded === lead.id && <div className="mt-3 border-t pt-3"><div className="flex gap-2"><input aria-label={`Note for ${lead.name}`} value={notes[lead.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [lead.id]: event.target.value }))} placeholder="Add an activity note" className="flex-1 p-2 border rounded text-sm"/><button disabled={saving === lead.id} onClick={() => addNote(lead.id)} className="bg-gray-800 text-white px-3 rounded text-sm">Add</button></div><div className="mt-3 space-y-2">{(activity[lead.id] ?? []).map((item) => <div key={item.id} className="text-xs bg-gray-50 rounded p-2"><span className="font-semibold">{item.kind.replace('_', ' ')}</span> · {item.body}<span className="block text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</span></div>)}{activity[lead.id]?.length === 0 && <p className="text-xs text-gray-400">No activity yet.</p>}</div></div>}</div>)}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-500 text-sm">🏠 Home</button><button onClick={() => router.push('/leads')} className="text-blue-600 text-sm">👤 Leads</button><button onClick={() => router.push('/inspections')} className="text-gray-500 text-sm">🔍 Inspections</button><button onClick={() => router.push('/settings')} className="text-gray-500 text-sm">⚙️ Settings</button></nav>
    </div>
  )
}
