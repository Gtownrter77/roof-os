'use client'

import { useRouter } from 'next/navigation'

export default function StatusPage() {
  const router = useRouter()
  return <div className="min-h-screen bg-gray-50 pb-20"><header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">System Status</h1></div></header><main className="p-4 max-w-2xl mx-auto"><section className="bg-white rounded-lg shadow p-5"><h2 className="font-semibold text-lg">Live service status is not connected</h2><p className="text-sm text-gray-600 mt-2">This screen no longer claims that database, API, weather, storage, or uptime services are online without live health evidence.</p><p className="text-xs text-gray-500 mt-4">Production health must come from real provider/runtime checks.</p></section></main></div>
}