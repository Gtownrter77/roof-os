'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = { id: string; name: string; address: string }

export default function EstimatePage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadId, setLeadId] = useState('')
  const [squares, setSquares] = useState('25')
  const [rate, setRate] = useState('0')
  const [note, setNote] = useState('Draft only. Not sent.')

  useEffect(() => {
    supabase.from('leads').select('id,name,address').order('created_at', { ascending: false }).limit(50).then(({ data }) => setLeads(data ?? []))
  }, [supabase])

  const sq = Number(squares) || 0
  const labor = Number(rate) || 0
  const draft = sq * labor
  const lead = leads.find((row) => row.id === leadId)

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/next10')} className="text-blue-600 text-sm mb-3">Next 10</button>
      <h1 className="text-2xl font-bold">Draft estimate</h1>
      <p className="text-sm text-gray-600 mb-4">Your squares. Your rate. No send. Photo-measure is not in this slice.</p>
      <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="w-full border rounded p-2 mb-3 text-sm">
        <option value="">Pick a lead</option>
        {leads.map((row) => <option key={row.id} value={row.id}>{row.name} — {row.address}</option>)}
      </select>
      <label className="block text-sm mb-2">Squares<input value={squares} onChange={(e) => setSquares(e.target.value)} className="w-full border rounded p-2 mt-1" inputMode="decimal" /></label>
      <label className="block text-sm mb-2">Labor $ / square (from your book)<input value={rate} onChange={(e) => setRate(e.target.value)} className="w-full border rounded p-2 mt-1" inputMode="decimal" /></label>
      <label className="block text-sm mb-3">Internal note<textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full border rounded p-2 mt-1" rows={2} /></label>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-500">{lead ? lead.address : 'No property selected'}</p>
        <p className="text-3xl font-bold mt-2">${draft.toFixed(2)}</p>
        <p className="text-xs text-amber-800 mt-2">DRAFT. Not a bid. Not emailed. Human must send.</p>
      </div>
    </div>
  )
}
