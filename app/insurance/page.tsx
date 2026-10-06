'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Carrier = {
  id: number
  name: string
  claims: string
  website: string
}

const carriers: Carrier[] = [
  { id: 1, name: 'Allstate', claims: 'Verify current claims contact', website: 'https://www.allstate.com/' },
  { id: 2, name: 'State Farm', claims: 'Verify current claims contact', website: 'https://www.statefarm.com/' },
  { id: 3, name: 'Progressive', claims: 'Verify current claims contact', website: 'https://www.progressive.com/' },
  { id: 4, name: 'Liberty Mutual', claims: 'Verify current claims contact', website: 'https://www.libertymutual.com/' },
  { id: 5, name: 'Farmers', claims: 'Verify current claims contact', website: 'https://www.farmers.com/' },
  { id: 6, name: 'GEICO', claims: 'Verify current claims contact', website: 'https://www.geico.com/' },
  { id: 7, name: 'Travelers', claims: 'Verify current claims contact', website: 'https://www.travelers.com/' },
  { id: 8, name: 'Nationwide', claims: 'Verify current claims contact', website: 'https://www.nationwide.com/' },
  { id: 9, name: 'American Family', claims: 'Verify current claims contact', website: 'https://www.amfam.com/' },
  { id: 10, name: 'USAA', claims: 'Verify current claims contact', website: 'https://www.usaa.com/' },
  { id: 11, name: 'The Hartford', claims: 'Verify current claims contact', website: 'https://www.thehartford.com/' },
  { id: 12, name: 'Chubb', claims: 'Verify current claims contact', website: 'https://www.chubb.com/' },
]

export default function InsurancePage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const filteredCarriers = carriers.filter((carrier) =>
    carrier.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">📞 Insurance Claims Directory</h1>
          <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">REFERENCE</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-900">
            Carrier contacts, availability, processing times, claim status, and filing workflows are not live-verified by ROOF/OS on this screen. Use the carrier&apos;s official site to confirm current claims instructions before calling or filing.
          </p>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search insurance companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
            aria-label="Search insurance companies"
          />
        </div>

        <div className="space-y-3">
          {filteredCarriers.map((carrier) => (
            <div key={carrier.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h2 className="font-semibold text-sm">{carrier.name}</h2>
                  <p className="text-xs text-gray-500">Claims contact: {carrier.claims}</p>
                  <p className="text-xs text-gray-500 mt-1">Current phone, coverage rules, and workflow should be verified with the carrier.</p>
                </div>
                <a
                  href={carrier.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 underline whitespace-nowrap"
                >
                  Official site
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button type="button" onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button type="button" onClick={() => router.push('/insurance')} className="flex flex-col items-center text-blue-600"><span className="text-xl">📞</span><span className="text-xs">Insurance</span></button>
        <button type="button" onClick={() => router.push('/insurance-intel')} className="flex flex-col items-center text-gray-400"><span className="text-xl">📋</span><span className="text-xs">Intel</span></button>
        <button type="button" onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400"><span className="text-xl">👤</span><span className="text-xs">Leads</span></button>
        <button type="button" onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
      </nav>
    </div>
  )
}
