'use client'

import { useRouter } from 'next/navigation'

export default function UpsellPage() {
  const router = useRouter()
  return <div className="min-h-screen bg-gray-50 pb-20"><header className="bg-blue-700 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">Upsell Intelligence</h1></div></header><main className="p-4 max-w-2xl mx-auto"><section className="bg-white rounded-lg shadow p-5"><h2 className="font-semibold text-lg">Recommendation engine is not connected</h2><p className="text-sm text-gray-600 mt-2">No ROI, profit margin, customer savings, warranty claim, or upgrade recommendation is fabricated from static assumptions.</p><p className="text-xs text-gray-500 mt-4">Recommendations should be generated from the active owner price book, actual job scope, and verified product data.</p></section></main></div>
}