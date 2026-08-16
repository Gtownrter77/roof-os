'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import QuickActions from '../components/QuickActions'

export default function Home() {
  const router = useRouter()
  const [leads, setLeads] = useState([
    { id: 1, name: 'John Doe', address: '123 Peachtree St, Atlanta, GA', status: 'New', time: '5 min ago' },
    { id: 2, name: 'Jane Smith', address: '456 Oak Ave, Marietta, GA', status: 'Assigned', time: '32 min ago' },
    { id: 3, name: 'Bob Johnson', address: '789 Pine Rd, Decatur, GA', status: 'Qualified', time: '1 hour ago' },
  ])
  const [stats, setStats] = useState({
    leads: 12,
    sla: 2,
    reports: 5,
    inspections: 8,
    customers: 47,
    revenue: 48200
  })
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} pb-20 transition-colors duration-300`}>
      <header className={`${darkMode ? 'bg-gray-800' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white shadow-lg sticky top-0 z-10`}>
        <div className="px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">⚡ ROOF/OS</h1>
            <p className="text-xs opacity-80">Atlanta's AI-Powered Roofing Command Center</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="bg-green-500 px-2 py-1 rounded text-xs animate-pulse">● Live</span>
            <button onClick={() => setDarkMode(!darkMode)} className="bg-white/20 px-2 py-1 rounded text-sm">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={() => router.push('/profile')} className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">A</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4">
        {/* Atlanta Weather Alert */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🌩️</span>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm">Severe Thunderstorm Warning - Atlanta Metro</p>
                <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded">Active</span>
              </div>
              <p className="text-xs text-yellow-700">Expires 8:00 PM EST • Affected: Fulton, DeKalb, Cobb</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Updated: {lastUpdate.toLocaleTimeString()}
          </p>
          <div className="flex gap-2">
            <button onClick={() => router.push('/manual')} className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
              📖 Manual
            </button>
            <button onClick={() => router.push('/pricing-config')} className="bg-teal-600 text-white text-xs px-3 py-1 rounded-full">
              💰 Pricing
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-3 text-center`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Leads</p>
            <p className="text-xl font-bold text-blue-600">{stats.leads}</p>
          </div>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-3 text-center`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Reports</p>
            <p className="text-xl font-bold text-yellow-600">{stats.reports}</p>
          </div>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-3 text-center`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Revenue</p>
            <p className="text-xl font-bold text-green-600">${(stats.revenue/1000).toFixed(1)}K</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <button onClick={() => router.push('/manual')} className={`${darkMode ? 'bg-gray-800' : 'bg-blue-50'} p-3 rounded-lg text-center border-2 border-blue-400`}>
            <span className="text-2xl block">📖</span>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-blue-600'} font-bold`}>Manual</span>
          </button>
          <button onClick={() => router.push('/pricing-config')} className={`${darkMode ? 'bg-gray-800' : 'bg-teal-50'} p-3 rounded-lg text-center border-2 border-teal-400`}>
            <span className="text-2xl block">💰</span>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-teal-600'} font-bold`}>Pricing</span>
          </button>
          <button onClick={() => router.push('/insurance-intel')} className={`${darkMode ? 'bg-gray-800' : 'bg-indigo-50'} p-3 rounded-lg text-center border-2 border-indigo-400`}>
            <span className="text-2xl block">📋</span>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-indigo-600'} font-bold`}>Intel</span>
          </button>
          <button onClick={() => router.push('/ai-train')} className={`${darkMode ? 'bg-gray-800' : 'bg-green-50'} p-3 rounded-lg text-center border-2 border-green-400`}>
            <span className="text-2xl block">🎓</span>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-green-600'} font-bold`}>Train</span>
          </button>
        </div>

        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`font-semibold text-sm ${darkMode ? 'text-gray-300' : ''}`}>Recent Activity</h2>
          </div>
          <div className="divide-y">
            {leads.map((lead) => (
              <div key={lead.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-medium text-sm ${darkMode ? 'text-gray-200' : ''}`}>{lead.name}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{lead.address}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{lead.status}</span>
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{lead.time}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <QuickActions />

      <nav className={`fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-t'} flex justify-around py-2 px-4`}>
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/manual')} className={`flex flex-col items-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
          <span className="text-xl">📖</span>
          <span className="text-xs">Manual</span>
        </button>
        <button onClick={() => router.push('/pricing-config')} className={`flex flex-col items-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/insurance-intel')} className={`flex flex-col items-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
          <span className="text-xl">📋</span>
          <span className="text-xs">Intel</span>
        </button>
        <button onClick={() => router.push('/settings')} className={`flex flex-col items-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
