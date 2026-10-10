'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FAQ = { q: string; a: string }

const FAQS: FAQ[] = [
  { q: 'How do I add a new lead?', a: 'Use New Lead from the dashboard or leads page. The lead is saved to the active workspace.' },
  { q: 'How do I take photos?', a: 'Open Camera, capture the inspection photos, and upload them. Photos are stored in the private inspection-photo workflow.' },
  { q: 'What is StormScore?', a: 'Storm data is corroborating evidence only. Review the weather and property evidence before using it in an inspection or estimate.' },
  { q: 'How do I export data?', a: 'Open Export and choose the available export format. Exported records come from the signed-in workspace.' },
  { q: 'What are SLA targets?', a: 'SLA targets are workspace operating targets. Configure and review your actual business standards before relying on them.' },
]

export default function HelpPage() {
  const router = useRouter()
  const [faqs] = useState(FAQS)

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">❓ Help & Support</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-lg p-4 mb-4">
          <h2 className="font-semibold text-sm">Support channels</h2>
          <p className="text-sm text-blue-900 mt-1">
            No customer support email, live-chat endpoint, or phone number is configured in this build. ROOF/OS will not display or invent a support contact that has not been provisioned.
          </p>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">📞 Contact Support</h2>
          <div className="border border-white/10 rounded-lg p-3">
            <p className="text-sm font-medium">Support contact not configured</p>
            <p className="text-xs text-slate-400 mt-1">Provision an approved support address, phone number, or chat integration before exposing a live contact action.</p>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-3">📖 Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-gray-100 pb-3 last:border-b-0">
                <p className="font-medium text-sm">{faq.q}</p>
                <p className="text-sm text-slate-400 mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button type="button" onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button type="button" onClick={() => router.push('/leads')} className="flex flex-col items-center text-slate-400"><span className="text-xl">👤</span><span className="text-xs">Leads</span></button>
        <button type="button" onClick={() => router.push('/export')} className="flex flex-col items-center text-slate-400"><span className="text-xl">📤</span><span className="text-xs">Export</span></button>
        <button type="button" onClick={() => router.push('/help')} className="flex flex-col items-center text-cyan-300"><span className="text-xl">❓</span><span className="text-xs">Help</span></button>
        <button type="button" onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
      </nav>
    </div>
  )
}
