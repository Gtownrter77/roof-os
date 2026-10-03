'use client'

import { useRouter } from 'next/navigation'

export default function AIPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">AI Workbench</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm mb-2">Not a live report generator</h2>
          <p className="text-sm text-gray-600">
            This screen does not generate inspection findings, damage claims, measurements, pricing, or customer reports.
            No simulated AI output is shown.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm mb-2">Verified workflow entry points</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use the persisted photo-estimate workflow for evidence-backed review. AI-assisted results remain subject to
            the existing technician and estimator approval gates.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/photo-estimate')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
            >
              Open Photo Estimate
            </button>
            <button
              onClick={() => router.push('/ai-train')}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold"
            >
              Open AI Training
            </button>
          </div>
        </section>
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
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
