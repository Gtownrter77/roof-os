'use client'

import { useRouter } from 'next/navigation'

export default function PredictPage() {
  const router = useRouter()
  return <div className="min-h-screen bg-gray-50 pb-20">
    <header className="bg-purple-700 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">Predictive AI</h1><span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">BETA</span></div></header>
    <main className="p-4 max-w-2xl mx-auto"><section className="bg-white rounded-lg shadow p-5"><h2 className="font-semibold text-lg">Predictive analysis is not connected</h2><p className="text-sm text-gray-600 mt-2">No risk score, roof-life estimate, storm forecast, cost projection, or recommended action is generated until a real predictive model and source data are connected.</p><p className="text-xs text-gray-500 mt-4">This screen will not display fabricated predictions.</p></section></main>
  </div>
}