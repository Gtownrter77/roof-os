'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = { id: string; name: string | null }

export default function PredictPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadId, setLeadId] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Loading saved leads.')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('leads').select('id,name').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (cancelled) return
      if (error) { setStatus(error.message); return }
      setLeads(data ?? [])
      setStatus(data && data.length ? 'Choose a saved lead. No model is called.' : 'No saved leads. A prediction cannot be stored yet.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  async function saveRequest() {
    setSaving(true)
    setStatus('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId || !leadId) {
      setStatus('A signed-in workspace and a saved lead are required.')
      setSaving(false)
      return
    }
    const body = `Prediction requested. No model called. Roof life, risk, storm timing, and cost are Unknown. Notes: ${notes.trim() || 'none'}`
    const { error } = await supabase.from('lead_activity').insert({ lead_id: leadId, workspace_id: workspaceId, user_id: user.id, kind: 'note', body })
    setStatus(error ? error.message : 'Request saved on the lead. Result remains Unknown.')
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Prediction</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        <label className="block text-sm bg-white rounded-lg shadow p-4">Saved lead
          <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="mt-1 w-full rounded border p-2">
            <option value="">Choose a lead</option>
            {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.id}</option>)}
          </select>
        </label>
        <label className="block text-sm bg-white rounded-lg shadow p-4">Observed notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded border p-2" rows={4} placeholder="What was seen on site" />
        </label>
        <button onClick={() => void saveRequest()} disabled={saving || !leadId} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">Save request</button>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg shadow p-4"><p className="text-gray-500">Roof life</p><p className="font-semibold">Unknown</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-gray-500">Risk</p><p className="font-semibold">Unknown</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-gray-500">Next storm</p><p className="font-semibold">Unknown</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-gray-500">Cost</p><p className="font-semibold">Unknown</p></div>
        </div>
      </main>
    </div>
  )
}
