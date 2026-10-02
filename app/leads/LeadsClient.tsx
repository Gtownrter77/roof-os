'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const statuses = ['all', 'new', 'assigned', 'qualified', 'inspection_scheduled', 'inspected', 'report_pending', 'report_approved', 'won', 'lost']
const priorityFilters = ['all', 'hot', 'warm', 'cold', 'needs_action', 'overdue']
type Lead = {
  id: string
  name: string
  address: string
  status: string
  phone?: string | null
  email?: string | null
  next_action?: string | null
  next_action_due?: string | null
  lead_score?: number
}

export default function LeadsClient() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadLeads() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const { data, error: queryError } = await supabase.from('leads').select('id,name,address,status,phone,email,next_action,next_action_due,lead_score').order('lead_score', { ascending: false }).order('created_at', { ascending: false })
      if (!active) return
      if (queryError) setError(queryError.message)
      else setLeads(data ?? [])
      setLoading(false)
    }
    void loadLeads()
    return () => { active = false }
  }, [router, supabase])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const now = Date.now()
    return leads.filter((lead) => {
      const score = lead.lead_score ?? 0
      const due = lead.next_action_due ? new Date(lead.next_action_due).getTime() : null
      const hasNextAction = Boolean(lead.next_action?.trim())
      const overdue = due !== null && due < now
      const needsAction = !hasNextAction && !['won', 'lost'].includes(lead.status)
      const priorityMatch =
        priority === 'all' ||
        (priority === 'hot' && score >= 70) ||
        (priority === 'warm' && score >= 40 && score < 70) ||
        (priority === 'cold' && score < 40) ||
        (priority === 'needs_action' && needsAction) ||
        (priority === 'overdue' && overdue)
      return (status === 'all' || lead.status === status) &&
        priorityMatch &&
        (!needle || [lead.name, lead.address, lead.phone, lead.email, lead.next_action].some((value) => (value || '').toLowerCase().includes(needle)))
    })
  }, [leads, query, status, priority])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div><button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button><h1 className="text-2xl font-bold">Leads</h1></div>
        <button onClick={() => router.push('/leads/new')} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">+ New lead</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, address, phone" className="p-2 border rounded text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 text-sm">{statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border rounded px-2 text-sm">{priorityFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading leads…</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {!loading && visible.length === 0 && <p className="text-sm text-gray-500">No leads match these filters.</p>}
      {visible.map((lead) => {
        const score = lead.lead_score ?? 0
        const overdue = Boolean(lead.next_action_due && new Date(lead.next_action_due).getTime() < Date.now())
        const needsAction = !lead.next_action?.trim() && !['won', 'lost'].includes(lead.status)
        return (
          <button key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-3">
            <div className="flex justify-between gap-3">
              <div><p className="font-semibold">{lead.name}</p><p className="text-sm text-gray-500">{lead.address}</p></div>
              <div className="text-right"><span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{lead.status.replaceAll('_', ' ')}</span><p className="text-xs font-semibold mt-1">{score}/100</p></div>
            </div>
            <div className="mt-2 text-xs">
              {needsAction && <span className="text-red-700 mr-3">Needs next action</span>}
              {overdue && <span className="text-orange-700 mr-3">Follow-up overdue</span>}
              {!needsAction && !overdue && lead.next_action && <span className="text-gray-600">Next: {lead.next_action}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
