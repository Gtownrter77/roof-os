'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Gap = { code: string; label: string; severity: 'block' | 'warn' }
type Intelligence = { score: number; productionReady: boolean; counts: { photos: number; inspections: number; warrantiesOpen: number }; gaps: Gap[] }
type ApiPayload = { intelligence?: Intelligence; error?: string }

export default function ReadyPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [payload, setPayload] = useState<ApiPayload | null>(null)
  const [error, setError] = useState('')

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
    <div className="space-y-4 p-1 pb-4">
      <button onClick={() => router.push(`/leads/${params.id}`)} className="text-cyan-300 text-sm mb-3">← Lead</button>
      <h1 className="text-2xl font-bold">Job ready?</h1>
      <p className="text-sm text-slate-300 mb-4">Checks the record. Does not look at pixels. Does not replace a superintendent.</p>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {intel && (
        <>
          <div className="glass rounded-xl p-4 mb-4">
            <p className="text-4xl font-bold">{intel.score}</p>
            <p className="text-sm">{intel.productionReady ? 'Ready for human production review' : 'Not ready'}</p>
            <p className="text-xs text-slate-400 mt-2">{intel.counts.photos} photos · {intel.counts.inspections} inspections · {intel.counts.warrantiesOpen} warranties open</p>
          </div>
          {intel.gaps.map((gap) => (
            <div key={gap.code} className={`rounded-lg p-3 mb-2 text-sm ${gap.severity === 'block' ? 'bg-red-400/10 text-red-800' : 'bg-amber-400/10 text-amber-100'}`}>
              {gap.label}
            </div>
          ))}
          <button onClick={() => router.push(`/passport/${params.id}`)} className="mt-3 ops-btn-primary w-full">Open Roof Passport</button>
        </>
      )}
    </div>
  )
}
