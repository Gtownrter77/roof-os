'use client'

import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function AIPage() {
  const router = useRouter()

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">🤖 AI Inspection Reports</h1>
        </div>
      </header>

      <main className="p-4">
        <section className="bg-amber-400/10 border border-amber-300 rounded-lg shadow p-4 mb-4" role="status">
          <h2 className="font-semibold text-amber-950">Report generation is evidence-based</h2>
          <p className="text-sm text-amber-100 mt-1">
            This screen no longer creates a report from browser-entered text or fabricated AI output.
            Reports must use the persisted inspection/photo-estimate workflow and remain human-review gated.
          </p>
        </section>

        <section className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-2">Use the verified report workflow</h2>
          <p className="text-sm text-slate-300 mb-4">
            Start or review an inspection in the photo-estimate workflow. The server builds the report from persisted evidence,
            applies the Golden Report rules, and saves it only when those rules pass.
          </p>
          <button
            type="button"
            onClick={() => router.push('/photo-estimate')}
            className="ops-btn-primary w-full py-3"
          >
            Open Photo Estimate
          </button>
        </section>

        <section className="glass rounded-xl p-5 mt-4">
          <h2 className="font-semibold mb-2">Authority boundary</h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
            <li>AI observations remain non-authoritative until verified.</li>
            <li>Measurements and quantities come from persisted evidence, not arbitrary browser text.</li>
            <li>Reports require human review before external use.</li>
          </ul>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-slate-400"><span className="text-xl">👤</span><span className="text-xs">Leads</span></button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-cyan-300"><span className="text-xl">🤖</span><span className="text-xs">AI</span></button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-slate-400"><span className="text-xl">🔔</span><span className="text-xs">Alerts</span></button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
      </nav>
    </div>
  )
}