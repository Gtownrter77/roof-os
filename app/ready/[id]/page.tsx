'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ReadyPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [payload, setPayload] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/intelligence/property?leadId=${params.id}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) setError(body.error ?? 'Could not score this property.')
        else setPayload(body)
      })
      .catch(() => setError('Could not score this property.'))
  }, [params.id])

  const intel = payload?.intelligence

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push(`/leads/${params.id}`)} className="text-blue-600 text-sm mb-3">← Lead</button>
      <h1 className="text-2xl font-bold">Job ready?</h1>
      <p className="text-sm text-gray-600 mb-4">Checks the record. Does not look at pixels. Does not replace a superintendent.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {intel && (
        <>
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <p className="text-4xl font-bold">{intel.score}</p>
            <p className="text-sm">{intel.productionReady ? 'Ready for human production review' : 'Not ready'}</p>
            <p className="text-xs text-gray-500 mt-2">{intel.counts.photos} photos · {intel.counts.inspections} inspections · {intel.counts.warrantiesOpen} warranties open</p>
          </div>
          {intel.gaps.map((gap: any) => (
            <div key={gap.code} className={`rounded-lg p-3 mb-2 text-sm ${gap.severity === 'block' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
              {gap.label}
            </div>
          ))}
          <button onClick={() => router.push(`/passport/${params.id}`)} className="mt-3 w-full bg-blue-600 text-white py-2 rounded font-semibold">Open Roof Passport</button>
        </>
      )}
    </div>
  )
}
