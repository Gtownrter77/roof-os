'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Supplement = { id: string; title: string; description: string; job_address: string; additional_cost: number; urgency: string; status: string; code_citation?: string }

const suggestions = [
  { title: 'Drip Edge Code Requirement', description: '2021 IRC R905.2.8.5 mandatory drip edge along eaves and gables', additionalCost: 650, urgency: 'high', codeCitation: '2021 IRC R905.2.8.5' },
  { title: 'Ice & Water Shield Underlayment', description: '2021 IRC R905.1.2 required in hail/freeze corridor', additionalCost: 1100, urgency: 'high', codeCitation: '2021 IRC R905.1.2' },
  { title: 'Roof Deck Damage Replacement', description: 'Rotting 7/16 OSB sheathing found under existing shingles', additionalCost: 2500, urgency: 'high', codeCitation: '2021 IRC R905.2.1' },
  { title: 'Flashing Replacement', description: 'Step & chimney flashing deteriorated/missing', additionalCost: 1800, urgency: 'medium', codeCitation: '2021 IRC R905.2.8.3' },
  { title: 'Gutter System Replacement', description: 'Damaged continuous aluminum gutters and downspouts', additionalCost: 3200, urgency: 'medium', codeCitation: 'Local Code Amendment' },
]

export default function SupplementPage() {
  const router = useRouter()
  const [jobAddress, setJobAddress] = useState('')
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [message, setMessage] = useState('')
  const [carrierEstimate, setCarrierEstimate] = useState<number>(14500)

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
      const response = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobAddress: address, ...suggestion, evidence: { source: 'IRC Statutory Building Code Candidate', codeCitation: suggestion.codeCitation } })
      })
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

  const totalApprovedSupplements = supplements.filter(s => s.status === 'approved').reduce((acc, s) => acc + Number(s.additional_cost), 0)
  const totalSupplementDelta = supplements.reduce((acc, s) => acc + Number(s.additional_cost), 0)
  const adjustedClaimTotal = carrierEstimate + totalApprovedSupplements

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📋 Supplement & IRC Code Upgrade Copilot</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
          <h2 className="text-sm font-bold text-gray-800 mb-2">Carrier Line-Item Delta Analysis</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500 block">Initial Carrier</span>
              <span className="font-bold text-sm">${carrierEstimate.toLocaleString()}</span>
            </div>
            <div className="bg-amber-50 p-2 rounded">
              <span className="text-amber-800 block">Identified Delta</span>
              <span className="font-bold text-sm text-amber-900">+${totalSupplementDelta.toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50 p-2 rounded">
              <span className="text-emerald-800 block">Approved Claim</span>
              <span className="font-bold text-sm text-emerald-900">${adjustedClaimTotal.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">Carrier variance: +{((totalApprovedSupplements / (carrierEstimate || 1)) * 100).toFixed(1)}% gain over carrier baseline.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium mb-1">Job address</label>
          <input value={jobAddress} onChange={(event) => setJobAddress(event.target.value)} className="w-full p-2 border rounded-lg text-sm" placeholder="123 Main St" />
          <p className="text-xs text-gray-500 mt-2">Candidates are persisted for human review with statutory citations attached.</p>
        </div>

        {message && <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded border border-blue-200" role="status">{message}</p>}

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm mb-3 text-gray-800">Statutory 2021 IRC Building Code Candidates</h2>
          {suggestions.map((suggestion) => (
            <button key={suggestion.title} onClick={() => void addSuggestion(suggestion)} className="w-full text-left border rounded-lg p-3 mb-2 hover:border-blue-500 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium text-sm block">{suggestion.title}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold mt-1 inline-block">{suggestion.codeCitation}</span>
                </div>
                <span className="text-blue-600 font-bold text-sm">+${suggestion.additionalCost.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{suggestion.description}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="font-bold text-sm text-gray-800">Workspace Supplement Ledger ({supplements.length})</h2>
          {supplements.map((supplement) => (
            <div key={supplement.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-300">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-sm">{supplement.title}</h3>
                <span className="text-sm font-bold text-blue-600">${Number(supplement.additional_cost).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{supplement.job_address} · <span className="capitalize font-semibold">{supplement.status}</span></p>
              {supplement.status === 'needs_review' && (
                <div className="flex gap-2 mt-3 pt-2 border-t">
                  <button onClick={() => void review(supplement.id, 'approved')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1 rounded font-semibold">Approve</button>
                  <button onClick={() => void review(supplement.id, 'rejected')} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded font-semibold">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
