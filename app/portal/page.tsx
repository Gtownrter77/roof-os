'use client'

import { useRouter } from 'next/navigation'

export default function PortalPage() {
  const router = useRouter()

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">Customer Portal</h1>
        </div>
      </header>

      <main className="p-4">
        <section className="glass rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-white">Customer records are not connected yet</h2>
          <p className="text-sm text-slate-300">
            This screen previously displayed sample customers. Those records were removed because they were not real workspace data.
            Use Leads for customer records currently stored in ROOF/OS.
          </p>
          <button
            onClick={() => router.push('/leads')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Open Leads
          </button>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span><span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">👥</span><span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🤖</span><span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🎤</span><span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span><span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
