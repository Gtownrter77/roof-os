'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAlerts, getForecast, getSeverityColor, getUrgencyLabel, type Forecast } from '../../lib/services/weather'

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

export default function WeatherPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [selectedState, setSelectedState] = useState('GA')
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void getAlerts(selectedState).then((data) => {
      if (cancelled) return
      setAlerts(data)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setError('Failed to fetch weather alerts.')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedState])

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not provide device location.')
      return
    }

    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void getForecast(position.coords.latitude, position.coords.longitude)
          .then((data) => {
            setForecast(data)
            if (!data) setError('The weather service could not resolve the device location.')
          })
          .catch(() => setError('Failed to fetch the local forecast.'))
          .finally(() => setLocating(false))
      },
      () => {
        setLocating(false)
        setError('Location permission was not granted. Alerts can still be viewed by state.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  async function refreshWeather() {
    setLoading(true)
    setError(null)
    try {
      setAlerts(await getAlerts(selectedState))
      if (forecast && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              void getForecast(position.coords.latitude, position.coords.longitude).then(setForecast).finally(resolve)
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          )
        })
      }
    } catch {
      setError('Failed to refresh weather data.')
    } finally {
      setLoading(false)
    }
  }

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
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🌤️ Weather</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="text-xs text-gray-500">Alert state</label>
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="w-full mt-1 p-2 border rounded-lg text-sm">
            {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
          <button type="button" onClick={useDeviceLocation} disabled={locating} className="w-full mt-2 bg-green-600 text-white py-2 rounded-lg font-semibold disabled:opacity-60">
            {locating ? 'Locating…' : 'Use my location for forecast'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-sm text-gray-500">Current Conditions</h2>
          {forecast ? (
            <div className="mt-2">
              <p className="text-3xl font-bold">{forecast.temperature}°F</p>
              <p className="text-gray-600">{forecast.conditions}</p>
            </div>
          ) : (
            <p className="text-gray-400">No forecast available</p>
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
                        Expires: {new Date(alert.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={() => void refreshWeather()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
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
