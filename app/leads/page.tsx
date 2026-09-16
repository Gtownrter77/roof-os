'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const statuses = ['all', 'new', 'assigned', 'qualified', 'inspection_scheduled', 'inspected', 'report_pending', 'report_approved', 'won', 'lost']
type Lead = { id: string; name: string; address: string; status: string; phone?: string | null; email?: string | null }

export default function LeadsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    void loadLeads()
    return () => { active = false }
  }, [router, supabase])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return leads.filter((lead) => {
      if (status !== 'all' && lead.status !== status) return false
      if (!needle) return true
      return [lead.name, lead.address, lead.phone, lead.email].some((value) => (value || '').toLowerCase().includes(needle))
    })
  }, [leads, query, status])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button>
          <h1 className="text-2xl font-bold">Leads</h1>
        </div>
        <button onClick={() => router.push('/leads/new')} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">+ New lead</button>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, address, phone" className="flex-1 p-2 border rounded text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 text-sm">
          {statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
        </select>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading leads…</p>}
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      {!loading && !error && visible.length === 0 && <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No matching leads.</div>}
      {visible.map((lead) => (
        <button key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold">{lead.name}</p>
              <p className="text-sm text-gray-500">{lead.address}</p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded h-fit">{lead.status.replaceAll('_', ' ')}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
