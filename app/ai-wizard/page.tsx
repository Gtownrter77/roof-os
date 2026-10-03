'use client'

import { useRouter } from 'next/navigation'

export default function AIWizardPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-indigo-700 text-white shadow sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl" aria-label="Back">←</button>
          <h1 className="text-xl font-bold">AI Construction Assistant</h1>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold">Assistant not connected</h2>
          <p className="text-sm text-gray-600 mt-2">
            This route previously returned hardcoded construction answers, code requirements, material lists,
            lifespans, costs, and confidence scores. Those outputs were not sourced or produced by an actual AI provider,
            so they are no longer presented as authoritative answers.
          </p>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          Building-code requirements, pricing, material performance, and permit requirements must come from a
          jurisdiction-appropriate source or an explicitly configured provider. ROOF/OS will not invent them.
        </section>

        <div className="grid gap-3">
          <button onClick={() => router.push('/ai')} className="w-full bg-indigo-700 text-white py-3 rounded-lg font-semibold">
            Open AI Workbench
          </button>
          <button onClick={() => router.push('/measure')} className="w-full bg-white border border-slate-300 py-3 rounded-lg font-semibold">
            Open AI Roof Measurement
          </button>
          <button onClick={() => router.push('/codes')} className="w-full bg-white border border-slate-300 py-3 rounded-lg font-semibold">
            Open Sourced Building Codes
          </button>
        </div>
      </main>
    </div>
  )
}
