 'use client'

import { useRouter } from 'next/navigation'

export default function LeadsPage() {
  const router = useRouter()
  const leads = [
    { name: 'John Doe', address: '123 Main St', status: 'New' },
    { name: 'Jane Smith', address: '456 Oak Ave', status: 'Assigned' },
    { name: 'Bob Johnson', address: '789 Pine Rd', status: 'Qualified' },
  ]
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <div><button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button><h1 className="text-2xl font-bold">👤 Leads</h1></div>
        <button onClick={() => router.push('/leads/new')} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">+ New lead</button>
      </div>
      {leads.map((lead, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{lead.name}</p>
          <p className="text-sm text-gray-500">{lead.address}</p>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{lead.status}</span>
        </div>
      ))}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-500 text-sm">🏠 Home</button><button onClick={() => router.push('/leads')} className="text-blue-600 text-sm">👤 Leads</button><button onClick={() => router.push('/inspections')} className="text-gray-500 text-sm">🔍 Inspections</button><button onClick={() => router.push('/settings')} className="text-gray-500 text-sm">⚙️ Settings</button></nav>
    </div>
  )
}
