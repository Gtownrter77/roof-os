'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Session = { id: string; status: string; started_at: string; lead_id: string | null; leadName: string; leadAddress: string }

function flatten(row: any): Session {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  return {
    id: row.id,
    status: row.status,
    started_at: row.started_at,
    lead_id: row.lead_id ?? null,
    leadName: lead?.name || 'Unlinked inspection',
    leadAddress: lead?.address || 'No address',
  }
}

export default function InspectionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const { data, error: queryError } = await supabase.from('inspection_sessions').select('id,status,started_at,lead_id,leads(name,address)').order('started_at', { ascending: false }).limit(50)
      if (queryError) setError(queryError.message)
      else setSessions((data ?? []).map(flatten))
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button><h1 className="text-xl font-bold">Inspections</h1></div></header>
      <main className="p-4">
        <div className="flex justify-between items-center mb-4"><p className="text-sm text-gray-500">{loading ? 'Loading…' : `${sessions.length} sessions`}</p><button onClick={() => router.push('/leads')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Start from a lead</button></div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!loading && sessions.length === 0 && !error && <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No inspection sessions yet. Open a lead and choose Start inspection now.</div>}
        {sessions.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow p-4 mb-3">
            <p className="font-semibold">{item.leadName}</p>
            <p className="text-sm text-gray-500">{item.leadAddress} · {item.status.replace('_', ' ')}</p>
            <div className="flex gap-2 mt-3">
              {item.lead_id && <button onClick={() => router.push(`/leads/${item.lead_id}`)} className="text-xs bg-gray-100 px-3 py-1 rounded">Open lead</button>}
              <button onClick={() => router.push(`/camera?inspection=${item.id}${item.lead_id ? `&lead=${item.lead_id}` : ''}`)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded">Photos</button>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
