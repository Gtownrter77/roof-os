'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type JobSize = 'small' | 'medium' | 'large'

const planningGuidance: Record<JobSize, { dumpster: string; reason: string }> = {
  small: { dumpster: '10–15 yard starting range', reason: 'Small repair, bathroom, deck, or limited debris job' },
  medium: { dumpster: '20–30 yard starting range', reason: 'Typical reroof, remodel, or moderate debris load' },
  large: { dumpster: '30–40 yard starting range', reason: 'Large renovation, whole-house, or commercial debris load' },
}

const providers = [
  {
    name: 'WM',
    kind: 'Dumpster rental',
    url: 'https://www.wm.com/',
    note: 'Check local availability, size, weight limits, rental period, and price using the job address.',
  },
  {
    name: 'Republic Services',
    kind: 'Dumpster rental',
    url: 'https://www.republicservices.com/',
    note: 'Use the service-area check for current dumpster options, pricing, and scheduling.',
  },
  {
    name: 'United Site Services',
    kind: 'Portable restrooms and site services',
    url: 'https://www.unitedsiteservices.com/',
    note: 'Request current site-service options and a quote for the job location.',
  },
]

export default function LogisticsPage() {
  const router = useRouter()
  const [zipCode, setZipCode] = useState('')
  const [jobSize, setJobSize] = useState<JobSize>('medium')
  const [planned, setPlanned] = useState(false)
  const [notice, setNotice] = useState('')

  const planLogistics = () => {
    const zip = zipCode.replace(/\D/g, '')
    if (zip && zip.length !== 5) {
      setNotice('ZIP code must contain five digits.')
      setPlanned(false)
      return
    }
    setZipCode(zip)
    setPlanned(true)
    setNotice(
      zip
        ? `Planning guidance prepared for ZIP ${zip}. Provider pricing, availability, and scheduling are not retrieved by ROOF/OS yet.`
        : 'Planning guidance prepared. Enter the job ZIP when you are ready to check providers directly.'
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">🚛 Job Site Logistics</h1>
          <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">REFERENCE</span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {notice && <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg text-sm" role="status">{notice}</div>}

        <section className="bg-white rounded-lg shadow-lg p-4 border border-blue-200">
          <h2 className="font-semibold">Logistics planning</h2>
          <p className="text-xs text-gray-600 mt-1">
            This screen provides planning guidance and verified provider links. It does not invent live pricing, availability, distance, ratings, or completed orders.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              maxLength={5}
              placeholder="Job ZIP code"
              aria-label="Job ZIP code"
              className="p-2 border rounded-lg text-sm"
            />
            <select value={jobSize} onChange={(e) => setJobSize(e.target.value as JobSize)} className="p-2 border rounded-lg text-sm">
              <option value="small">Small Job</option>
              <option value="medium">Medium Job</option>
              <option value="large">Large Job</option>
            </select>
            <button type="button" onClick={planLogistics} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              Plan logistics
            </button>
          </div>
        </section>

        {planned && (
          <section className="bg-white rounded-lg shadow-lg p-4 border border-green-200">
            <h2 className="font-semibold">Planning recommendation</h2>
            <p className="text-2xl font-bold text-blue-700 mt-2">{planningGuidance[jobSize].dumpster}</p>
            <p className="text-sm text-gray-600 mt-1">{planningGuidance[jobSize].reason}.</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mt-3">
              Planning range only. Final container size, allowable materials, weight limits, delivery space, rental period, availability, and price must be confirmed with the provider.
            </p>
          </section>
        )}

        <section className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="font-semibold mb-3">Verified provider links</h2>
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider.name} className="border rounded-lg p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-semibold">{provider.name}</p>
                    <p className="text-xs text-gray-500">{provider.kind}</p>
                  </div>
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 underline whitespace-nowrap"
                  >
                    Open provider
                  </a>
                </div>
                <p className="text-sm text-gray-600 mt-2">{provider.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-900">
            <strong>Not an order:</strong> selecting a planning range does not reserve a dumpster or restroom. A future live integration must create a persisted request and receive a provider confirmation before ROOF/OS can call it ordered.
          </p>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button type="button" onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span><span className="text-xs">Home</span>
        </button>
        <button type="button" onClick={() => router.push('/logistics')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🚛</span><span className="text-xs">Logistics</span>
        </button>
        <button type="button" onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span><span className="text-xs">Templates</span>
        </button>
        <button type="button" onClick={() => router.push('/upsell')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span><span className="text-xs">Upsell</span>
        </button>
        <button type="button" onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span><span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
