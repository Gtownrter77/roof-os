'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Session = { id: string; status: string; lead_id: string | null; leadName: string; leadAddress: string }

function flatten(row: any): Session {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  return {
    id: row.id,
    status: row.status,
    lead_id: row.lead_id ?? null,
    leadName: lead?.name || 'Unlinked inspection',
    leadAddress: lead?.address || '',
  }
}

export default function ReportsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const { data, error: queryError } = await supabase.from('inspection_sessions').select('id,status,lead_id,leads(name,address)').order('started_at', { ascending: false }).limit(50)
      if (queryError) setError(queryError.message)
      else setSessions((data ?? []).map(flatten))
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  function openPhotoWorkflow(session: Session) {
    router.push(`/photo-estimate?inspection=${encodeURIComponent(session.id)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button>
      <h1 className="text-2xl font-bold mb-2">Inspection reports</h1>
      <p className="text-sm text-gray-600 mb-4">Reports start from saved photos. The full report uses technician-approved quantities and keeps NOAA dates and pricing review-gated.</p>
      {error && <div className="bg-red-50 text-red-800 rounded p-3 mb-4 text-sm">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Loading inspections…</p>}
      {sessions.map((session) => (
        <div key={session.id} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{session.leadName}</p>
          <p className="text-sm text-gray-500">{session.leadAddress || 'No address'} · {session.status.replace('_', ' ')}</p>
          <button onClick={() => openPhotoWorkflow(session)} className="mt-3 bg-blue-600 text-white text-sm px-3 py-2 rounded">Open photo-to-report workflow</button>
        </div>
      ))}
    </div>
  )
}
