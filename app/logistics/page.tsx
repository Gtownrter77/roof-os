'use client'

import { useRouter } from 'next/navigation'

export default function LogisticsPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Logistics</h1>
        </div>
      </header>
      <main className="p-4">
        <p className="text-sm bg-white rounded-lg shadow p-4">Dumpster and portable toilet vendors, distance, and price are Unknown. This screen does not place an order.</p>
      </main>
    </div>
  )
}
