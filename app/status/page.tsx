'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type ServiceStatus = 'online' | 'offline' | 'checking' | 'unknown'

type StatusState = {
  database: ServiceStatus
  api: ServiceStatus
  weather: ServiceStatus
  storage: ServiceStatus
}

export default function StatusPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<StatusState>({
    database: 'checking',
    api: 'online',
    weather: 'unknown',
    storage: 'unknown',
  })

  useEffect(() => {
    let active = true

    async function checkDatabase() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (active) setStatus((current) => ({ ...current, database: 'offline' }))
        return
      }

      const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
      if (!active) return
      setStatus((current) => ({
        ...current,
        database: error || !workspaceId ? 'offline' : 'online',
      }))
    }

    void checkDatabase()
    return () => {
      active = false
    }
  }, [supabase])

  const getStatusColor = (value: ServiceStatus) => {
    switch (value) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'checking': return 'bg-yellow-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusText = (value: ServiceStatus) => {
    switch (value) {
      case 'online': return 'Online'
      case 'offline': return 'Offline'
      case 'checking': return 'Checking…'
      default: return 'Not checked'
    }
  }

  const services: Array<{ name: string; key: keyof StatusState }> = [
    { name: 'Application', key: 'api' },
    { name: 'Database / workspace', key: 'database' },
    { name: 'Weather Service', key: 'weather' },
    { name: 'Storage', key: 'storage' },
  ]

  const hasFailure = Object.values(status).some((value) => value === 'offline')
  const hasUnknown = Object.values(status).some((value) => value === 'unknown' || value === 'checking')

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
          <div className="text-4xl mb-2">{hasFailure ? '🔴' : hasUnknown ? '🟡' : '🟢'}</div>
          <h2 className="text-xl font-bold">
            {hasFailure ? 'A checked service is unavailable' : hasUnknown ? 'Status partially verified' : 'Checked services operational'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            This page reports only checks actually performed from the current session. Uptime is not inferred.
          </p>
        </div>

        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.key} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-gray-600">{getStatusText(status[service.key])}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status[service.key])}`} />
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
