'use client'

import { useState } from 'react'
import { getAlertsAtPoint, getForecast, getNwsRelativeLocation, type Forecast, type WeatherAlert } from '../lib/services/weather'

export type LoginPreviewData = {
  latitude: number
  longitude: number
  label: string
  checkedAt: string
  forecast: Forecast | null
  alerts: WeatherAlert[] | null
}

type Props = { onLocationChange?: (preview: LoginPreviewData | null) => void }

export default function LoginWeatherPreview({ onLocationChange }: Props) {
  const [preview, setPreview] = useState<LoginPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function shareLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not provide location access. Sign in to load your workspace ZIP instead.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(async (position) => {
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      const [labelResult, forecastResult, alertsResult] = await Promise.allSettled([
        getNwsRelativeLocation(latitude, longitude),
        getForecast(latitude, longitude),
        getAlertsAtPoint(latitude, longitude),
      ])
      const nextPreview: LoginPreviewData = {
        latitude,
        longitude,
        label: labelResult.status === 'fulfilled' && labelResult.value ? labelResult.value : 'Selected device location',
        checkedAt: new Date().toISOString(),
        forecast: forecastResult.status === 'fulfilled' ? forecastResult.value : null,
        alerts: alertsResult.status === 'fulfilled' ? alertsResult.value : null,
      }
      setPreview(nextPreview)
      onLocationChange?.(nextPreview)
      if (alertsResult.status === 'rejected') setError('NWS alerts could not be verified; no alert status is assumed.')
      setLoading(false)
    }, () => {
      setError(preview ? 'Location was not refreshed; the last successful preview remains shown.' : 'Location was not shared. No local weather is shown; you can still sign in normally.')
      setLoading(false)
    }, { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8_000 })
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-xl backdrop-blur" aria-labelledby="login-weather-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Location-aware radar preview</p>
          <h2 id="login-weather-title" className="mt-1 text-lg font-bold text-white">Weather stays off until you choose a location</h2>
        </div>
        <button type="button" onClick={() => void shareLocation()} disabled={loading} className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
          {loading ? 'Checking…' : preview ? 'Refresh my location' : 'Use my location'}
        </button>
      </div>

      {preview ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Selected location</p>
            <p className="mt-1 text-sm font-semibold text-white">{preview.label}</p>
            {preview.forecast ? <><p className="mt-3 text-3xl font-black text-white">{preview.forecast.temperature}°{preview.forecast.temperatureUnit}</p><p className="text-sm text-slate-300">{preview.forecast.period}: {preview.forecast.conditions}</p></> : <p className="mt-3 text-sm text-amber-100">NWS forecast: Unknown</p>}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">NWS active alerts</p>
            <p className="mt-2 text-3xl font-black text-white">{preview.alerts === null ? 'Unknown' : preview.alerts.length}</p>
            <p className="mt-1 text-xs text-slate-300">{preview.alerts === null ? 'The alert source did not return a verified result.' : 'Official point-based active-alert response.'}</p>
            <a className="mt-3 inline-block text-xs text-cyan-300 underline" href="https://api.weather.gov/alerts/active" target="_blank" rel="noreferrer">NWS alert source</a>
          </div>
          <p className="sm:col-span-2 text-xs leading-5 text-cyan-100">The dramatic map background now follows this selected location. Radar: NOAA/NWS MRMS where available · Basemap: OpenFreeMap · © OpenStreetMap contributors.</p>
        </div>
      ) : (
        <div className="mt-4 flex min-h-32 items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-900/70 px-5 py-6 text-center">
          <p className="max-w-md text-sm leading-6 text-slate-300">No sample storm or guessed city is shown. Share this device’s location to load the official NOAA radar and NWS forecast for this area.</p>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-amber-200" role="status">{error}</p>}
      <p className="mt-3 text-[11px] leading-5 text-slate-400">If you opt in, coordinates are used to request NWS data and OpenFreeMap/NOAA map tiles; this page does not save them. Sign in to use your workspace service ZIP instead.</p>
    </section>
  )
}
