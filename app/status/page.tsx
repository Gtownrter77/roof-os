'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type ServiceStatus = 'online' | 'offline' | 'unknown' | 'checking'
type HealthPayload = {
  overall: 'operational' | 'degraded'
  services: Record<'database' | 'api' | 'weather' | 'storage', ServiceStatus>
  uptime: 'not_measured'
  checkedAt: string
  responseMs: number
}

const initialServices: HealthPayload['services'] = {
  database: 'checking',
  api: 'checking',
  weather: 'checking',
  storage: 'checking',
}

export default function StatusPage() {
  const router = useRouter()
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [services, setServices] = useState(initialServices)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/status', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Status check failed.')
        return payload as HealthPayload
      })
      .then((payload) => {
        if (cancelled) return
        setHealth(payload)
        setServices(payload.services)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Status check failed.')
        setServices({ database: 'unknown', api: 'offline', weather: 'unknown', storage: 'unknown' })
      })
    return () => { cancelled = true }
  }, [])

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'checking': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: ServiceStatus) => {
    switch (status) {
      case 'online': return 'Online'
      case 'offline': return 'Offline'
      case 'checking': return 'Checking...'
      default: return 'Unknown'
    }
  }

  const serviceRows = [
    { name: 'Database', key: 'database' as const },
    { name: 'API', key: 'api' as const },
    { name: 'Weather Service', key: 'weather' as const },
    { name: 'Storage', key: 'storage' as const },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">System Status</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-6 text-center mb-4">
          <div className="text-4xl mb-2">{health?.overall === 'operational' ? '🟢' : '🟡'}</div>
          <h2 className="text-xl font-bold">
            {health ? (health.overall === 'operational' ? 'All Checked Systems Operational' : 'System Degraded') : 'Checking Systems'}
          </h2>
          <p className="text-sm text-gray-500">
            Uptime: {health?.uptime === 'not_measured' ? 'Not measured' : 'Checking'}
          </p>
          {health && <p className="text-xs text-gray-400 mt-1">Checked {new Date(health.checkedAt).toLocaleString()} in {health.responseMs}ms</p>}
          {error && <p className="text-sm text-red-700 mt-2" role="alert">{error}</p>}
        </div>

        <div className="space-y-2">
          {serviceRows.map((service) => (
            <div key={service.key} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-gray-600">{getStatusText(services[service.key])}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(services[service.key])}`} />
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button onClick={() => router.push('/status')} className="flex flex-col items-center text-blue-600"><span className="text-xl">📊</span><span className="text-xs">Status</span></button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
        <button onClick={() => router.push('/profile')} className="flex flex-col items-center text-gray-400"><span className="text-xl">👤</span><span className="text-xs">Profile</span></button>
        <button onClick={() => router.push('/plans')} className="flex flex-col items-center text-gray-400"><span className="text-xl">💰</span><span className="text-xs">Plans</span></button>
      </nav>
    </div>
  )
}
