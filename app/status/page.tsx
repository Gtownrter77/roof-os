'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

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
      case 'online': return 'bg-emerald-400/100'
      case 'offline': return 'bg-red-400/100'
      case 'checking': return 'bg-amber-400/100'
      default: return 'bg-white/50'
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
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">System Status</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="glass rounded-xl p-6 text-center mb-4">
          <div className="text-4xl mb-2">{health?.overall === 'operational' ? '🟢' : '🟡'}</div>
          <h2 className="text-xl font-bold">
            {health ? (health.overall === 'operational' ? 'All Checked Systems Operational' : 'System Degraded') : 'Checking Systems'}
          </h2>
          <p className="text-sm text-slate-400">
            Uptime: {health?.uptime === 'not_measured' ? 'Not measured' : 'Checking'}
          </p>
          {health && <p className="text-xs text-slate-400 mt-1">Checked {new Date(health.checkedAt).toLocaleString()} in {health.responseMs}ms</p>}
          {error && <p className="text-sm text-red-700 mt-2" role="alert">{error}</p>}
        </div>

        <div className="space-y-2">
          {serviceRows.map((service) => (
            <div key={service.key} className="glass rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-slate-300">{getStatusText(services[service.key])}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(services[service.key])}`} />
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button onClick={() => router.push('/status')} className="flex flex-col items-center text-cyan-300"><span className="text-xl">📊</span><span className="text-xs">Status</span></button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
        <button onClick={() => router.push('/profile')} className="flex flex-col items-center text-slate-400"><span className="text-xl">👤</span><span className="text-xs">Profile</span></button>
        <button onClick={() => router.push('/plans')} className="flex flex-col items-center text-slate-400"><span className="text-xl">💰</span><span className="text-xs">Plans</span></button>
      </nav>
    </div>
  )
}
