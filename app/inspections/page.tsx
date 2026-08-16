'use client'

import { useRouter } from 'next/navigation'

export default function InspectionsPage() {
  const router = useRouter()
  const inspections = [
    { address: '123 Main St', status: 'In Progress', photos: 3 },
    { address: '456 Oak Ave', status: 'Completed', photos: 5 },
    { address: '789 Pine Rd', status: 'Scheduled', photos: 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔍 Inspections</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{inspections.length} inspections</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
            + New Inspection
          </button>
        </div>

        {inspections.map((item, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 mb-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{item.address}</p>
                <p className="text-sm text-gray-500">Status: {item.status}</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                📷 {item.photos}
              </span>
            </div>
            <button 
              onClick={() => router.push('/camera')}
              className="mt-2 bg-blue-50 text-blue-600 text-sm px-3 py-1 rounded flex items-center"
            >
              📸 Take Photos
            </button>
          </div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/inspections')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Inspect</span>
        </button>
        <button onClick={() => router.push('/camera')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📷</span>
          <span className="text-xs">Camera</span>
        </button>
        <button onClick={() => router.push('/weather')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🌤️</span>
          <span className="text-xs">Weather</span>
        </button>
      </nav>
    </div>
  )
}
