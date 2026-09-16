'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = { id: string; name: string; address: string; status: string }

export default function CanvassPage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    supabase.from('leads').select('id,name,address,status').order('created_at', { ascending: false }).limit(50).then(({ data }) => setLeads(data ?? []))
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/next10')} className="text-blue-600 text-sm mb-3">Next 10</button>
      <h1 className="text-2xl font-bold">Canvass</h1>
      <p className="text-sm text-gray-600 mb-4">Our customers first. New doors second. Hail swaths are not in this build. NWS headlines live on Map.</p>
      <div className="bg-amber-50 rounded-lg p-3 mb-4 text-sm text-amber-900">Alert layer: candidate only. Do not tell a homeowner they were hit because a warning exists in the state.</div>
      <h2 className="font-semibold mb-2">Knock these first</h2>
      {leads.length === 0 && <p className="text-sm text-gray-500">No files yet. Add a lead.</p>}
      {leads.map((lead) => (
        <button key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="w-full text-left bg-white rounded-lg shadow p-3 mb-2">
          <p className="font-medium text-sm">{lead.name}</p>
          <p className="text-xs text-gray-500">{lead.address} · {lead.status.replaceAll('_', ' ')}</p>
        </button>
      ))}
    </div>
  )
}
