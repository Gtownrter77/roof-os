'use client'

import { useRouter } from 'next/navigation'

export default function CodesPage() {
  const router = useRouter()
  return <div className="min-h-screen bg-gray-50 pb-20"><header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">Building Codes</h1></div></header><main className="p-4 max-w-2xl mx-auto"><section className="bg-white rounded-lg shadow p-5"><h2 className="font-semibold text-lg">Authoritative jurisdiction lookup is not connected</h2><p className="text-sm text-gray-600 mt-2">Static state/category fixtures are not presented as current legal requirements, permit rules, wind zones, or jurisdiction-specific code advice.</p><p className="text-xs text-gray-500 mt-4">Code guidance remains review-gated until a current authoritative jurisdiction source is connected.</p></section></main></div>
}