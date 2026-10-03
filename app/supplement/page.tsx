'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Supplement = { id: string; title: string; description: string; job_address: string; additional_cost: number; urgency: string; status: string }

export default function SupplementPage() {
  const router = useRouter()
  const [jobAddress, setJobAddress] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [additionalCost, setAdditionalCost] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const response = await fetch('/api/supplements')
    const result = await response.json()
    if (response.ok) setSupplements(result.supplements ?? [])
    else setMessage(result.error ?? 'Could not load supplements.')
  }

  useEffect(() => { void load() }, [])

  const addCandidate = async () => {
    if (!jobAddress.trim() || !title.trim()) { setMessage('Enter the job address and supplement title.'); return }
    const parsedCost = additionalCost.trim() === '' ? 0 : Number(additionalCost)
    if (!Number.isFinite(parsedCost) || parsedCost < 0) { setMessage('Additional cost must be a valid non-negative number, or leave it blank when unknown.'); return }
    setLoading(true); setMessage('')
    try {
      const response = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobAddress, title, description, additionalCost: parsedCost, urgency, evidence: { source: 'owner-entered candidate for review' } }),
      })
      const result = await response.json()
      if (!response.ok) { setMessage(result.error ?? 'Could not save supplement.'); return }
      setMessage('Supplement saved as needs_review. Pricing remains owner-entered until supported by evidence.')
      setTitle(''); setDescription(''); setAdditionalCost(''); setUrgency('medium')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save supplement.')
    } finally { setLoading(false) }
  }

  const review = async (id: string, status: 'approved' | 'rejected') => {
    const response = await fetch('/api/supplements', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (response.ok) await load()
    else setMessage('Could not update supplement review.')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl" aria-label="Back">←</button><h1 className="text-xl font-bold">Supplement Review</h1></div></header>
      <main className="p-4 max-w-2xl mx-auto">
        <section className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold">Add a review candidate</h2>
          <p className="text-xs text-gray-500 mt-1">ROOF/OS does not invent supplement findings or prices. Enter the observed issue and any supported cost; blank cost means the amount is unknown and is stored as $0 until a sourced amount is entered.</p>
          <label className="block text-sm font-medium mt-4">Job address<input value={jobAddress} onChange={(e) => setJobAddress(e.target.value)} className="mt-1 w-full p-2 border rounded-lg" placeholder="Job address" /></label>
          <label className="block text-sm font-medium mt-3">Issue / supplement title<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full p-2 border rounded-lg" placeholder="Observed issue" /></label>
          <label className="block text-sm font-medium mt-3">Description / evidence note<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full p-2 border rounded-lg" placeholder="What was actually observed?" /></label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="text-sm font-medium">Additional cost<input type="number" min="0" step="0.01" value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} className="mt-1 w-full p-2 border rounded-lg" placeholder="Unknown" /></label>
            <label className="text-sm font-medium">Urgency<select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="mt-1 w-full p-2 border rounded-lg"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          </div>
          {message && <p className="text-sm text-blue-700 mt-3" role="status">{message}</p>}
          <button onClick={() => void addCandidate()} disabled={loading} className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-semibold disabled:opacity-60">{loading ? 'Saving…' : 'Save for Review'}</button>
        </section>
        <section className="space-y-3">
          {supplements.map((supplement) => (
            <div key={supplement.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between gap-3"><h2 className="font-semibold">{supplement.title}</h2><span className="text-sm text-blue-600">{Number(supplement.additional_cost) > 0 ? `$${Number(supplement.additional_cost).toFixed(2)}` : 'Cost unknown'}</span></div>
              <p className="text-xs text-gray-500 mt-1">{supplement.job_address} · {supplement.status}</p>
              {supplement.description && <p className="text-sm text-gray-700 mt-2">{supplement.description}</p>}
              {supplement.status === 'needs_review' && <div className="flex gap-2 mt-3"><button onClick={() => void review(supplement.id, 'approved')} className="bg-green-600 text-white text-xs px-3 py-1 rounded">Approve</button><button onClick={() => void review(supplement.id, 'rejected')} className="bg-red-600 text-white text-xs px-3 py-1 rounded">Reject</button></div>}
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
