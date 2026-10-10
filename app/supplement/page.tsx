'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Supplement = { id: string; title: string; description: string; job_address: string; additional_cost: number; urgency: string; status: string }
const suggestions = [
  { title: 'Roof Deck Damage', description: 'Rotting wood found under shingles', additionalCost: 2500, urgency: 'high' },
  { title: 'Flashing Failure', description: 'Chimney flashing is deteriorated', additionalCost: 1800, urgency: 'medium' },
  { title: 'Gutter System Replacement', description: 'Gutters require full replacement', additionalCost: 3200, urgency: 'medium' },
]

export default function SupplementPage() {
  const router = useRouter()
  const [jobAddress, setJobAddress] = useState('')
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [message, setMessage] = useState('')
  const load = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/supplements', { signal })
      const result = await response.json().catch(() => ({}))
      if (signal?.aborted) return
      if (response.ok) setSupplements(result.supplements ?? [])
      else setMessage(result.error ?? 'Could not load supplements.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('Could not load supplements because the network request failed.')
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])
  const addSuggestion = async (suggestion: typeof suggestions[number]) => {
    const address = jobAddress.trim()
    if (!address) { setMessage('Enter the job address first.'); return }
    try {
      const response = await fetch('/api/supplements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobAddress: address, ...suggestion, evidence: { source: 'owner-entered candidate for review' } }) })
      const result = await response.json().catch(() => ({}))
      setMessage(response.ok ? 'Supplement saved as needs_review.' : (result.error ?? 'Could not save supplement.'))
      if (response.ok) await load()
    } catch {
      setMessage('Could not save supplement because the network request failed.')
    }
  }
  const review = async (id: string, status: 'approved' | 'rejected') => {
    setMessage(status === 'approved' ? 'Approving supplement…' : 'Rejecting supplement…')
    try {
      const response = await fetch('/api/supplements', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'Could not update supplement review.')
        return
      }
      setMessage(status === 'approved' ? 'Supplement approved.' : 'Supplement rejected.')
      await load()
    } catch {
      setMessage('Could not update supplement because the network request failed.')
    }
  }
  return <div className="space-y-4 pb-4"><header className="glass sticky top-0 z-10 rounded-xl mb-4"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button><h1 className="text-xl font-bold">📋 Supplement Review</h1></div></header><main className="p-4"><div className="glass rounded-xl p-4 mb-4"><label className="block text-sm font-medium mb-1">Job address</label><input value={jobAddress} onChange={(event) => setJobAddress(event.target.value)} className="ops-input" placeholder="123 Main St" /><p className="text-xs text-slate-400 mt-2">Candidates are persisted for human review; no supplement is externally approved automatically.</p></div>{message && <p className="text-sm text-cyan-300 mb-3" role="status">{message}</p>}<div className="glass rounded-xl p-4 mb-4"><h2 className="font-semibold mb-3">Add candidate</h2>{suggestions.map((suggestion) => <button key={suggestion.title} onClick={() => void addSuggestion(suggestion)} className="w-full text-left border rounded-lg p-3 mb-2 hover:border-blue-500"><div className="flex justify-between"><span className="font-medium">{suggestion.title}</span><span className="text-cyan-300">+${suggestion.additionalCost.toFixed(2)}</span></div><p className="text-xs text-slate-400">{suggestion.description}</p></button>)}</div><div className="space-y-3">{supplements.map((supplement) => <div key={supplement.id} className="glass rounded-xl p-4"><div className="flex justify-between"><h2 className="font-semibold">{supplement.title}</h2><span className="text-sm text-cyan-300">${Number(supplement.additional_cost).toFixed(2)}</span></div><p className="text-xs text-slate-400">{supplement.job_address} · {supplement.status}</p>{supplement.status === 'needs_review' && <div className="flex gap-2 mt-3"><button onClick={() => void review(supplement.id, 'approved')} className="bg-green-600 text-white text-xs px-3 py-1 rounded">Approve</button><button onClick={() => void review(supplement.id, 'rejected')} className="bg-red-600 text-white text-xs px-3 py-1 rounded">Reject</button></div>}</div>)}</div></main></div>
}
