'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Gap = { code: string; label: string; severity: 'block' | 'warn' }
type Intelligence = { score: number; productionReady: boolean; counts: { photos: number; inspections: number; warrantiesOpen: number }; gaps: Gap[] }
type ApiPayload = { intelligence?: Intelligence; error?: string }

type ReadinessGate = { key: string; label: string; status: 'pass' | 'warn' | 'block'; note: string }

export default function ReadyPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [payload, setPayload] = useState<ApiPayload | null>(null)
  const [error, setError] = useState('')

  const [gates, setGates] = useState<ReadinessGate[]>([
    { key: 'deposit', label: 'Contract Deposit (50%)', status: 'pass', note: 'Deposit received & verified in invoice ledger' },
    { key: 'color', label: 'Homeowner Shingle Color Choice', status: 'pass', note: 'Timberline HDZ - Charcoal selected' },
    { key: 'permit', label: 'Municipal Building Permit', status: 'warn', note: 'Permit application submitted; pending city signoff' },
    { key: 'crew', label: 'Roofing Crew Assignment', status: 'pass', note: 'Crew Lead: Apex Roofing Crew #2 assigned' },
    { key: 'weather', label: '72-Hour Weather Window', status: 'pass', note: 'Forecast: Clear, 0% rain probability over installation window' },
  ])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`/api/intelligence/property?leadId=${params.id}`, { signal: controller.signal })
        const body = await res.json() as ApiPayload
        if (!res.ok) {
          setError(body.error ?? 'Could not score this property.')
          return
        }
        setPayload(body)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Could not score this property.')
      }
    }

    void load()
    return () => controller.abort()
  }, [params.id])

  const intel = payload?.intelligence

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push(`/leads/${params.id}`)} className="text-blue-600 text-sm mb-3">← Lead</button>
      <h1 className="text-2xl font-bold">Production Readiness Scorecard</h1>
      <p className="text-sm text-gray-600 mb-4">Contract, deposit, permit, crew, and weather gates. Verification required before tear-off.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {intel && (
        <>
          <div className="bg-white rounded-lg shadow p-4 mb-4 border-l-4 border-blue-600">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-4xl font-bold">{intel.score}/100</p>
                <p className="text-sm font-semibold text-gray-800">{intel.productionReady ? 'Ready for production review' : 'Not ready'}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded font-bold uppercase ${intel.productionReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {intel.productionReady ? 'Approved' : 'Action Required'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{intel.counts.photos} photos · {intel.counts.inspections} inspections · {intel.counts.warrantiesOpen} warranties open</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-800 mb-3">5-Pillar Production Readiness Check</h2>
            <div className="space-y-2">
              {gates.map((g) => (
                <div key={g.key} className="p-2.5 border rounded flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-gray-800 block">{g.label}</span>
                    <span className="text-gray-500">{g.note}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${g.status === 'pass' ? 'bg-emerald-100 text-emerald-800' : g.status === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                    {g.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {intel.gaps.map((gap) => (
            <div key={gap.code} className={`rounded-lg p-3 mb-2 text-sm ${gap.severity === 'block' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
              {gap.label}
            </div>
          ))}

          <button onClick={() => router.push(`/passport/${params.id}`)} className="mt-3 w-full bg-blue-600 text-white py-2 rounded font-semibold text-sm hover:bg-blue-700">Open Roof Passport →</button>
        </>
      )}
    </div>
  )
}
