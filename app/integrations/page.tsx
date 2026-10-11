'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function IntegrationsPage() {
  const router = useRouter()
  const [connected, setConnected] = useState<Record<string, boolean>>({
    'Google Calendar': true,
    'Stripe': true,
    'Home Depot Pro': true
  })

  const integrations = [
    { id: 'gcal', name: 'Google Calendar', icon: '📅', description: 'Sync sales rep & field inspection schedules.', category: 'Scheduling' },
    { id: 'stripe', name: 'Stripe Payments', icon: '💳', description: 'Instant 50% deposit checkout links and invoices.', category: 'Payments' },
    { id: 'homedepot', name: 'Home Depot Pro', icon: '🛠️', description: 'Real-time Live Material Pricing & Local Inventory Sync.', category: 'Suppliers' },
    { id: 'slack', name: 'Slack', icon: '💬', description: 'Receive instant lead alerts & job milestone notifications.', category: 'Communication' },
    { id: 'quickbooks', name: 'QuickBooks Online', icon: '📊', description: 'Sync progress invoices, O&P, and subcontractor payouts.', category: 'Accounting' },
    { id: 'zapier', name: 'Zapier Webhooks', icon: '⚡', description: 'Connect Roof-OS to over 5,000 external cloud apps.', category: 'Automation' }
  ]

  const toggleConnection = (name: string) => {
    setConnected(prev => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-xl">←</button>
            <h1 className="text-xl font-bold text-white">🔌 Ecosystem & Provider Integrations</h1>
          </div>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">
            Active Hub
          </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lg font-semibold text-white">
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{item.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className={`text-xs font-mono ${connected[item.name] ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {connected[item.name] ? '● Connected' : '○ Not Configured'}
                </span>
                <button
                  onClick={() => toggleConnection(item.name)}
                  className={`text-xs font-medium px-3 py-1.5 rounded transition-all ${
                    connected[item.name]
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {connected[item.name] ? 'Configure' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
