'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { getAlerts, getForecast, getSeverityColor, getUrgencyLabel } from '../../lib/services/weather'

interface WeatherAlert {
  id: string
  headline: string
  description: string
  severity: string
  urgency: string
  certainty: string
  expiresAt: string
  zones: string[]
}

interface WeatherLocation {
  latitude: number
  longitude: number
  label: string
  isFallback: boolean
}

interface NwsCandidate {
  eventType?: string
  eventDate?: string | null
  expires?: string | null
  severity?: string | null
  headline?: string | null
  sourceUrl?: string | null
}

const DEFAULT_LOCATION: WeatherLocation = {
  latitude: 33.7490,
  longitude: -84.3880,
  label: 'Atlanta, GA (default)',
  isFallback: true,
}

function getDeviceLocation(): Promise<WeatherLocation> {
  if (!navigator.geolocation) return Promise.resolve(DEFAULT_LOCATION)

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: 'Current device location',
        isFallback: false,
      }),
      () => resolve(DEFAULT_LOCATION),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 7_000 },
    )
  })
}

async function getPointAlerts(supabase: ReturnType<typeof createClient>, location: WeatherLocation): Promise<WeatherAlert[]> {
  if (location.isFallback) return getAlerts('GA')

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return []

  const params = new URLSearchParams({
    workspaceId,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
  })
  const response = await fetch(`/api/storms/nws?${params.toString()}`, { cache: 'no-store' })
  const payload = await response.json() as { candidates?: NwsCandidate[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Weather alert lookup failed.')

  return (Array.isArray(payload.candidates) ? payload.candidates : []).map((candidate, index) => ({
    id: candidate.sourceUrl ?? `nws-${index}-${candidate.eventDate ?? 'unknown'}`,
    headline: candidate.headline ?? candidate.eventType ?? 'Severe weather alert',
    description: 'NWS alert relevant to the selected location. Verify the official alert details before acting.',
    severity: candidate.severity ?? 'Unknown',
    urgency: 'Unknown',
    certainty: 'Candidate',
    expiresAt: candidate.expires ?? '',
    zones: [],
  }))
}

export default function WeatherPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [forecast, setForecast] = useState<{ temperature: number; conditions: string; icon: string } | null>(null)
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION.label)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchWeather() {
    setLoading(true)
    setError(null)

    try {
      const location = await getDeviceLocation()
      const supabase = createClient()
      const [alertsData, forecastData] = await Promise.all([
        getPointAlerts(supabase, location),
        getForecast(location.latitude, location.longitude),
      ])

      setLocationLabel(location.label)
      setAlerts(alertsData)
      setForecast(forecastData)

      if (location.isFallback) {
        setError('Device location was unavailable. Showing Atlanta, GA as the fallback location.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data')
      setAlerts([])
      setForecast(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchWeather()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🌤️</div>
          <p className="text-gray-500">Loading weather data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">🌤️ Weather</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-sm text-gray-500">Current Conditions</h2>
          <p className="text-xs text-gray-400 mt-1">{locationLabel}</p>
          {forecast ? (
            <div className="mt-2">
              <p className="text-3xl font-bold">{forecast.temperature}°F</p>
              <p className="text-gray-600">{forecast.conditions}</p>
            </div>
          ) : (
            <p className="text-gray-400 mt-2">No forecast available</p>
          )}
        </div>

        <div className="mb-4">
          <h2 className="font-semibold text-sm text-gray-500 mb-2">Active Alerts ({alerts.length})</h2>
          {alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 text-sm">✅ No active weather alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="bg-white rounded-lg shadow p-4 mb-3">
                <div className="flex items-start space-x-3">
                  <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{alert.headline}</p>
                    <p className="text-xs text-gray-500 mt-1">{alert.description.substring(0, 150)}...</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-400">{getUrgencyLabel(alert.urgency)}</span>
                      <span className="text-xs text-gray-400">
                        {alert.expiresAt ? `Expires: ${new Date(alert.expiresAt).toLocaleString()}` : 'Expiration unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <button onClick={() => void fetchWeather()} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">
          🔄 Refresh Weather
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400 text-center">
          Data from National Weather Service API
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/inspections')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Inspect</span>
        </button>
        <button onClick={() => router.push('/reports')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Reports</span>
        </button>
        <button onClick={() => router.push('/weather')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🌤️</span>
          <span className="text-xs">Weather</span>
        </button>
      </nav>
    </div>
  )
}
