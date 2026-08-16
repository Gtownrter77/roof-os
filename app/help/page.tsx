'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HelpPage() {
  const router = useRouter()
  const [faqs] = useState([
    { q: 'How do I add a new lead?', a: 'Click the + New Lead button on the dashboard or leads page.' },
    { q: 'How do I take photos?', a: 'Go to Camera page and tap Take Photo. Photos are saved automatically.' },
    { q: 'What is StormScore?', a: 'A 0-100 score showing storm severity and operational priority.' },
    { q: 'How do I export data?', a: 'Go to Export page and choose CSV or PDF format.' },
    { q: 'What are SLA targets?', a: 'Response time targets. Default is 15 minutes for first response.' },
  ])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">❓ Help & Support</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">📞 Contact Support</h2>
          <div className="space-y-2">
            <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm">
              📧 Email Support
            </button>
            <button className="w-full bg-green-600 text-white py-2 rounded-lg text-sm">
              💬 Live Chat
            </button>
            <button className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">
              📱 Call: 1-800-ROOF-OS
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm mb-3">📖 Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-gray-100 pb-3">
                <p className="font-medium text-sm">{faq.q}</p>
                <p className="text-sm text-gray-500 mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">ROOF/OS v2.0 • Documentation available</p>
        </div>
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
        <button onClick={() => router.push('/export')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📤</span>
          <span className="text-xs">Export</span>
        </button>
        <button onClick={() => router.push('/help')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">❓</span>
          <span className="text-xs">Help</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
