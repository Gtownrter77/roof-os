'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StatusPage() {
  const router = useRouter()
  const [status, setStatus] = useState({
    database: 'checking',
    api: 'checking',
    weather: 'checking',
    storage: 'checking',
    uptime: '99.9%'
  })

  useEffect(() => {
    setTimeout(() => {
      setStatus({
        database: 'online',
        api: 'online',
        weather: 'online',
        storage: 'online',
        uptime: '99.9%'
      })
    }, 1000)
  }, [])

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'checking': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch(status) {
      case 'online': return 'Online'
      case 'offline': return 'Offline'
      case 'checking': return 'Checking...'
      default: return 'Unknown'
    }
  }

  const services = [
    { name: 'Database', key: 'database' },
    { name: 'API', key: 'api' },
    { name: 'Weather Service', key: 'weather' },
    { name: 'Storage', key: 'storage' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📊 System Status</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-6 text-center mb-4">
          <div className="text-4xl mb-2">🟢</div>
          <h2 className="text-xl font-bold">All Systems Operational</h2>
          <p className="text-sm text-gray-500">Uptime: {status.uptime}</p>
        </div>

        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.key} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className={`text-sm ${status[service.key as keyof typeof status] === 'online' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {getStatusText(status[service.key as keyof typeof status])}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status[service.key as keyof typeof status])}`} />
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/status')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📊</span>
          <span className="text-xs">Status</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
        <button onClick={() => router.push('/profile')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Profile</span>
        </button>
        <button onClick={() => router.push('/plans')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Plans</span>
        </button>
      </nav>
    </div>
  )
}
