'use client'

import { useRouter } from 'next/navigation'

export default function IntegrationsPage() {
  const router = useRouter()

  const integrations = [
    { name: 'Google Calendar', icon: '📅' },
    { name: 'Slack', icon: '💬' },
    { name: 'QuickBooks', icon: '📊' },
    { name: 'Stripe', icon: '💳' },
    { name: 'Gmail', icon: '📧' },
    { name: 'HubSpot', icon: '📈' },
    { name: 'Dropbox', icon: '📁' },
    { name: 'Zapier', icon: '⚡' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔌 Integrations</h1>
        </div>
      </header>

      <main className="p-4"><div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-amber-900">Connection status is Unknown until a real provider check or OAuth connection has completed. No integration is assumed connected.</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">🔗 Connect your favorite tools</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {integrations.map((integration, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg transition">
              <span className="text-3xl block mb-2">{integration.icon}</span>
              <p className="font-semibold text-sm">{integration.name}</p>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                Unknown — not checked
              </span>
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/integrations')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔌</span>
          <span className="text-xs">Integrations</span>
        </button>
        <button onClick={() => router.push('/admin')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔐</span>
          <span className="text-xs">Admin</span>
        </button>
        <button onClick={() => router.push('/activity')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
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
