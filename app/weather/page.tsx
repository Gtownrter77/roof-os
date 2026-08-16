'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function WeatherPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWeather()
  }, [])

  async function fetchWeather() {
    setLoading(true)
    setError(null)
    
    try {
      const lat = 33.7490
      const lon = -84.3880
      
      const [alertsData, forecastData] = await Promise.all([
        getAlerts('GA'),
        getForecast(lat, lon)
      ])
      
      setAlerts(alertsData)
      setForecast(forecastData)
    } catch (err) {
      setError('Failed to fetch weather data')
      console.error(err)
    }
    
    setLoading(false)
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
          onClick={fetchWeather}
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
