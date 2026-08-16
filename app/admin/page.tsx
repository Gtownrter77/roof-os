'use client'

import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()

  const stats = [
    { label: 'Total Users', value: '24', change: '+3' },
    { label: 'Total Leads', value: '156', change: '+12%' },
    { label: 'Active Inspections', value: '18', change: '+2' },
    { label: 'Reports Generated', value: '89', change: '+8%' },
    { label: 'Revenue', value: '$48.2K', change: '+15%' },
    { label: 'Storage Used', value: '2.4GB', change: '+5%' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔐 Admin Dashboard</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold text-blue-600">{stat.value}</p>
              <p className="text-xs text-green-600">{stat.change}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-sm mb-3">📊 System Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Server</span>
              <span className="text-xs text-green-600">🟢 Online</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Database</span>
              <span className="text-xs text-green-600">🟢 Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Storage</span>
              <span className="text-xs text-green-600">🟢 Available</span>
            </div>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/admin')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔐</span>
          <span className="text-xs">Admin</span>
        </button>
        <button onClick={() => router.push('/activity')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
