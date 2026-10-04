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
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/supplements')
      const result = await response.json()
      if (response.ok) setSupplements(result.supplements ?? [])
      else setMessage(result.error ?? 'Could not load supplements.')
    } catch {
      setMessage('Could not load supplements. Check the network and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  const addSuggestion = async (suggestion: typeof suggestions[number]) => {
    if (!jobAddress.trim()) { setMessage('Enter the job address first.'); return }
    if (savingKey) return
    setSavingKey(`add:${suggestion.title}`)
    try {
      const response = await fetch('/api/supplements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobAddress: jobAddress.trim(), ...suggestion, evidence: { source: 'owner-entered candidate for review' } }) })
      const result = await response.json()
      setMessage(response.ok ? 'Supplement saved as needs_review.' : (result.error ?? 'Could not save supplement.'))
      if (response.ok) await load()
    } catch {
      setMessage('Could not save supplement. Check the network and try again.')
    } finally {
      setSavingKey('')
    }
  }
  const review = async (id: string, status: 'approved' | 'rejected') => {
    if (savingKey) return
    setSavingKey(`review:${id}`)
    try {
      const response = await fetch('/api/supplements', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) })
      if (response.ok) await load()
      else {
        const result = await response.json().catch(() => null) as { error?: string } | null
        setMessage(result?.error ?? 'Could not update supplement review.')
      }
    } catch {
      setMessage('Could not update supplement review. Check the network and try again.')
    } finally {
      setSavingKey('')
    }
  }
  return <div className="min-h-screen bg-gray-50 pb-20"><header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">📋 Supplement Review</h1></div></header><main className="p-4"><div className="bg-white rounded-lg shadow p-4 mb-4"><label className="block text-sm font-medium mb-1">Job address</label><input value={jobAddress} onChange={(event) => setJobAddress(event.target.value)} className="w-full p-2 border rounded-lg" placeholder="123 Main St" /><p className="text-xs text-gray-500 mt-2">Candidates are persisted for human review; no supplement is externally approved automatically.</p></div>{message && <p className="text-sm text-blue-700 mb-3" role="status">{message}</p>}<div className="bg-white rounded-lg shadow p-4 mb-4"><h2 className="font-semibold mb-3">Add candidate</h2>{suggestions.map((suggestion) => <button key={suggestion.title} onClick={() => void addSuggestion(suggestion)} className="w-full text-left border rounded-lg p-3 mb-2 hover:border-blue-500"><div className="flex justify-between"><span className="font-medium">{suggestion.title}</span><span className="text-blue-600">+${suggestion.additionalCost.toFixed(2)}</span></div><p className="text-xs text-gray-500">{suggestion.description}</p></button>)}</div>{loading ? <p className="text-sm text-gray-500">Loading supplements…</p> : <div className="space-y-3">{supplements.map((supplement) => <div key={supplement.id} className="bg-white rounded-lg shadow p-4"><div className="flex justify-between"><h2 className="font-semibold">{supplement.title}</h2><span className="text-sm text-blue-600">${Number(supplement.additional_cost).toFixed(2)}</span></div><p className="text-xs text-gray-500">{supplement.job_address} · {supplement.status}</p>{supplement.status === 'needs_review' && <div className="flex gap-2 mt-3"><button onClick={() => void review(supplement.id, 'approved')} className="bg-green-600 text-white text-xs px-3 py-1 rounded">Approve</button><button onClick={() => void review(supplement.id, 'rejected')} className="bg-red-600 text-white text-xs px-3 py-1 rounded">Reject</button></div>}</div>)}</div></main></div>
}
