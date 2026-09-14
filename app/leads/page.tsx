'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = { id: string; name: string; address: string; status: string; phone?: string | null; email?: string | null }

export default function LeadsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
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
    loadLeads()
    return () => { active = false }
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <div><button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button><h1 className="text-2xl font-bold">👤 Leads</h1></div>
        <button onClick={() => router.push('/leads/new')} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">+ New lead</button>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading leads…</p>}
      {error && <p className="text-sm text-red-600" role="alert">Could not load leads: {error}</p>}
      {!loading && !error && leads.length === 0 && <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No leads yet. Add your first lead to get started.</div>}
      {leads.map((lead) => (
        <div key={lead.id} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{lead.name}</p>
          <p className="text-sm text-gray-500">{lead.address}</p>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{lead.status}</span>
        </div>
      ))}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-500 text-sm">🏠 Home</button><button onClick={() => router.push('/leads')} className="text-blue-600 text-sm">👤 Leads</button><button onClick={() => router.push('/inspections')} className="text-gray-500 text-sm">🔍 Inspections</button><button onClick={() => router.push('/settings')} className="text-gray-500 text-sm">⚙️ Settings</button></nav>
    </div>
  )
}
