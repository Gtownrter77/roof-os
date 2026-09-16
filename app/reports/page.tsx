'use client'

import { useEffect, useState } from 'react'
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
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<any>(null)
  const [working, setWorking] = useState('')

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

  async function generate(session: Session) {
    if (!session.leadAddress) { setError('This inspection has no lead address.'); return }
    setWorking(session.id); setError(''); setReport(null)
    const photoRes = await supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).eq('inspection_id', session.id)
    const response = await fetch('/api/reports/inspection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: session.leadAddress, roofSquares: 1, gutterLf: 0, photoCount: photoRes.count ?? 0 }) })
    const payload = await response.json()
    if (!response.ok) setError(payload.error ?? 'Could not generate report.')
    else {
      setReport({ ...payload.report, inspectionId: session.id, leadId: session.lead_id })
      if (session.lead_id) await supabase.from('leads').update({ status: 'report_pending', updated_at: new Date().toISOString() }).eq('id', session.lead_id)
    }
    setWorking('')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button>
      <h1 className="text-2xl font-bold mb-2">Inspection reports</h1>
      <p className="text-sm text-gray-600 mb-4">Reports start from a saved inspection. Pricing stays review-gated.</p>
      {error && <div className="bg-red-50 text-red-800 rounded p-3 mb-4 text-sm">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Loading inspections…</p>}
      {sessions.map((session) => (
        <div key={session.id} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{session.leadName}</p>
          <p className="text-sm text-gray-500">{session.leadAddress || 'No address'} · {session.status.replace('_', ' ')}</p>
          <button disabled={working === session.id} onClick={() => void generate(session)} className="mt-3 bg-blue-600 text-white text-sm px-3 py-2 rounded disabled:opacity-60">{working === session.id ? 'Generating…' : 'Draft report from this inspection'}</button>
        </div>
      ))}
      {report && (
        <div className="bg-white rounded-lg shadow p-4 mt-4">
          <h2 className="font-bold">{report.title}</h2>
          <p className="text-sm mt-2">{report.address}</p>
          <p className="text-sm text-gray-600">Photos used: {report.evidence?.photoCount ?? 0}</p>
          {report.leadId && <button onClick={() => router.push(`/leads/${report.leadId}`)} className="mt-3 text-sm text-blue-600">Open lead</button>}
        </div>
      )}
    </div>
  )
}
