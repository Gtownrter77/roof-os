'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

type Watch = {
  place: string
  forecast: string
  alerts: string[]
  note: string
}

export default function PredictPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [watch, setWatch] = useState<Watch | null>(null)

  async function loadWatch() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/weather/summary', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Weather could not be checked.')
      const alerts = Array.isArray(payload.alerts)
        ? payload.alerts.map((alert: { headline?: string }) => alert.headline).filter(Boolean)
        : []
      const forecast = payload.forecast
        ? `${payload.forecast.period}: ${payload.forecast.temperature}°${payload.forecast.temperatureUnit}, ${payload.forecast.conditions}`
        : 'Forecast Unknown'
      setWatch({
        place: payload.location?.label ?? 'Workspace location',
        forecast,
        alerts,
        note: 'Roof life, risk score, and repair cost stay Unknown. This screen does not invent them.',
      })
    } catch (cause) {
      setWatch(null)
      setError(cause instanceof Error ? cause.message : 'Weather could not be checked.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Storm watch</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <p className="text-sm glass rounded-xl p-4">
          Uses the live National Weather Service check for this workspace. It is not a damage forecast and it does not call a paid model.
        </p>
        <button
          type="button"
          onClick={() => void loadWatch()}
          disabled={loading}
          className="w-full rounded-lg bg-cyan-400 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? 'Checking weather…' : 'Check current storm watch'}
        </button>
        {error ? <p className="text-sm text-amber-200" role="alert">{error}</p> : null}
        {watch ? (
          <section className="glass rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">{watch.place}</h2>
            <p className="text-sm text-slate-200">{watch.forecast}</p>
            {watch.alerts.length === 0 ? (
              <p className="text-sm text-slate-400">No active alerts in this check.</p>
            ) : (
              <ul className="space-y-2 text-sm text-amber-100">
                {watch.alerts.map((headline) => <li key={headline}>{headline}</li>)}
              </ul>
            )}
            <p className="text-xs text-slate-400">{watch.note}</p>
            <button type="button" onClick={() => router.push('/radar')} className="text-sm font-semibold text-cyan-300">
              Open radar cinema
            </button>
          </section>
        ) : null}
      </main>
    </div>
  )
}
