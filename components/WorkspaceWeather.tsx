'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import WeatherRadarMap from './WeatherRadarMap'
import { getRadarServiceForPoint } from '../lib/services/radar-source.mjs'
import type { Forecast, WeatherAlert } from '../lib/services/weather'

type RadarService = NonNullable<ReturnType<typeof getRadarServiceForPoint>>
type TickerMetric = { label: string; value: number | null }
type Summary = {
  status: 'ready' | 'location_missing'
  checkedAt?: string
  location?: { postalCode: string; label: string; latitude: number; longitude: number; source: string }
  forecast?: Forecast | null
  forecastStatus?: 'available' | 'unknown'
  alerts?: WeatherAlert[]
  alertSource?: string
  radar?: RadarService | null
  radarStatus?: string
  error?: string
  message?: string
}

function checkedTime(value?: string) {
  if (!value) return 'time unknown'
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? 'time unknown' : parsed.toLocaleString()
}

function safeNwsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'weather.gov' || url.hostname.endsWith('.weather.gov')) ? url.toString() : 'https://api.weather.gov/alerts/active'
  } catch {
    return 'https://api.weather.gov/alerts/active'
  }
}

function tickerText(summary: Summary | null, error: string | null, metrics: TickerMetric[]) {
  if (error) return ['WEATHER STATUS · NOT VERIFIED', 'NO ALERT COUNT ASSUMED', 'CHECK THE WORKSPACE SERVICE ZIP OR RETRY']
  if (summary?.status === 'location_missing') return ['LOCAL WEATHER · NOT CONFIGURED', 'SET THE WORKSPACE SERVICE ZIP IN SETTINGS', 'NO SAMPLE LOCATION IS SHOWN']
  if (summary?.status !== 'ready') return ['LOCAL WEATHER · CHECKING OFFICIAL SOURCES']
  const forecast = summary.forecast
    ? `${summary.forecast.period.toUpperCase()} · ${summary.forecast.temperature}°${summary.forecast.temperatureUnit} · ${summary.forecast.conditions.toUpperCase()}`
    : 'NWS FORECAST · UNKNOWN'
  return [
    `SERVICE AREA · ${summary.location?.label ?? 'Unknown'} ${summary.location?.postalCode ?? ''}`,
    `NWS ACTIVE ALERTS · ${summary.alerts?.length ?? 'Unknown'}`,
    forecast,
    `RADAR · ${summary.radar ? `${summary.radar.label} · ${summary.radar.resolution}` : 'NOAA COVERAGE UNAVAILABLE'}`,
    `WEATHER CHECKED · ${checkedTime(summary.checkedAt)}`,
    ...metrics.map((item) => `${item.label.toUpperCase()} · ${item.value === null ? 'UNKNOWN' : item.value}`),
  ]
}

export default function WorkspaceWeather({ variant = 'full', tickerMetrics = [] }: { variant?: 'full' | 'compact' | 'hero'; tickerMetrics?: TickerMetric[] }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [tickerPaused, setTickerPaused] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/weather/summary', { cache: 'no-store' })
      const payload = await response.json() as Summary
      if (!response.ok) throw new Error(payload.error ?? 'Weather could not be verified.')
      setSummary(payload)
    } catch (cause) {
      setSummary(null)
      setError(cause instanceof Error ? cause.message : 'Weather could not be verified. No alert status is assumed.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => setRefresh((value) => value + 1), 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [load, refresh])

  const hero = variant === 'hero'
  const compact = variant === 'compact'
  const shell = hero
    ? 'relative min-h-[470px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1320] shadow-2xl'
    : compact
      ? 'rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-2xl backdrop-blur'
      : 'rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-2xl backdrop-blur md:p-6'
  const tickerItems = tickerText(summary, error, tickerMetrics)
  const tickerContent = tickerItems.join('   •   ')

  return (
    <section className={shell} aria-labelledby="workspace-weather-title">
      {hero && summary?.status === 'ready' && summary.location && (
        <div className="absolute inset-0 z-0">
          <WeatherRadarMap latitude={summary.location.latitude} longitude={summary.location.longitude} locationLabel={summary.location.label} refreshKey={summary.checkedAt} className="h-full w-full rounded-none border-0" />
        </div>
      )}
      {hero && <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#060a12]/95 via-[#07101c]/80 to-[#070b14]/55" />}

      <div className={hero ? 'relative z-10 flex min-h-[470px] flex-col p-4 md:p-6' : ''}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">{hero ? 'Live roofing operations · official weather sources' : 'Local weather · official sources'}</p>
            <h2 id="workspace-weather-title" className="mt-1 text-lg font-bold text-white md:text-xl">
              {hero ? 'Regional radar & workspace pulse' : summary?.location ? `${summary.location.label} · ${summary.location.postalCode}` : 'Workspace radar & alerts'}
            </h2>
          </div>
          <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="rounded-lg border border-white/20 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50">
            {loading ? 'Checking…' : 'Refresh weather'}
          </button>
        </div>

        {loading && !summary && <p className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200" role="status">Checking the configured service ZIP with NWS and NOAA…</p>}
        {error && <p className="rounded-xl border border-amber-300/30 bg-slate-950/85 p-4 text-sm text-amber-100" role="alert">{error} No weather or alert count is inferred.</p>}

        {summary?.status === 'location_missing' && (
          <div className="max-w-2xl rounded-xl border border-cyan-300/20 bg-slate-950/80 p-5 text-sm text-slate-200 backdrop-blur">
            <p className="font-semibold text-white">Local radar is not configured yet.</p>
            <p className="mt-1">{summary.message ?? 'Set the workspace service-area ZIP before showing weather.'}</p>
            <Link href="/settings" className="mt-4 inline-flex rounded-lg bg-cyan-400 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-300">Set service ZIP in Settings</Link>
          </div>
        )}

        {summary?.status === 'ready' && summary.location && (
          hero ? (
            <div className="grid flex-1 gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] md:items-center">
              <div className="max-w-2xl self-center rounded-2xl border border-white/10 bg-slate-950/35 p-4 backdrop-blur-[2px] md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">{summary.location.label} · service ZIP {summary.location.postalCode}</p>
                <h3 className="mt-2 text-3xl font-black leading-tight text-white md:text-5xl">Real weather.<br />Real work.</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">The map is centered on the workspace service ZIP. Counts below come from ROOF/OS workspace records; weather facts are linked to NWS/NOAA sources.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/weather" className="rounded-lg border border-white/20 bg-slate-950/50 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Open weather & radar</Link>
                  <Link href="/leads/new" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">Create a lead</Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                <div className="rounded-xl border border-white/15 bg-slate-950/75 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Next NWS forecast period</p>
                  {summary.forecast ? <><p className="mt-2 text-3xl font-black text-white">{summary.forecast.temperature}°{summary.forecast.temperatureUnit}</p><p className="text-sm font-semibold text-cyan-200">{summary.forecast.period}</p><p className="mt-1 text-sm text-slate-300">{summary.forecast.conditions}</p></> : <p className="mt-2 text-sm text-amber-100">Forecast: Unknown — no NWS period was returned.</p>}
                </div>
                <div className={`rounded-xl border p-4 backdrop-blur ${summary.alerts?.length ? 'border-red-300/30 bg-red-950/80' : 'border-emerald-300/20 bg-slate-950/75'}`}>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">NWS active alerts at this point</p>
                  <p className={`mt-1 text-3xl font-black ${summary.alerts?.length ? 'text-red-300' : 'text-emerald-300'}`}>{summary.alerts?.length ?? '—'}</p>
                  <p className="mt-1 text-xs text-slate-300">Checked {checkedTime(summary.checkedAt)}</p>
                  {!summary.alerts?.length && <p className="mt-2 text-xs text-slate-300">No active alerts were returned for this location in this check.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
              <WeatherRadarMap latitude={summary.location.latitude} longitude={summary.location.longitude} locationLabel={summary.location.label} refreshKey={summary.checkedAt} className={compact ? 'h-64 md:h-72' : 'h-72 md:h-[390px]'} />
              <div className="grid content-start gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Next NWS forecast period</p>
                  {summary.forecast ? <><p className="mt-2 text-3xl font-black text-white">{summary.forecast.temperature}°{summary.forecast.temperatureUnit}</p><p className="mt-1 text-sm font-semibold text-cyan-200">{summary.forecast.period}</p><p className="mt-1 text-sm text-slate-300">{summary.forecast.conditions}</p></> : <p className="mt-2 text-sm text-amber-100">Forecast: Unknown — no NWS forecast period was returned.</p>}
                </div>
                <div className={`rounded-xl border p-4 ${summary.alerts?.length ? 'border-red-300/30 bg-red-500/10' : 'border-emerald-300/20 bg-emerald-500/5'}`}>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">NWS active alerts at this point</p>
                  <p className={`mt-1 text-3xl font-black ${summary.alerts?.length ? 'text-red-300' : 'text-emerald-300'}`}>{summary.alerts?.length ?? '—'}</p>
                  <p className="mt-1 text-xs text-slate-300">Checked {checkedTime(summary.checkedAt)}</p>
                  {!summary.alerts?.length && <p className="mt-2 text-xs text-slate-300">No active alerts were returned for this location in this check.</p>}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-300">
                  <p><strong className="text-white">Radar:</strong> {summary.radar?.label ?? 'Unknown'}{summary.radar ? ` · ${summary.radar.resolution}` : ''}</p>
                  <p><strong className="text-white">Location:</strong> workspace service ZIP; geocoded by OpenStreetMap Nominatim.</p>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <a className="text-cyan-300 underline" href="https://api.weather.gov/" target="_blank" rel="noreferrer">NWS forecast & alerts</a>
                    <a className="text-cyan-300 underline" href="https://www.weather.gov/gis/" target="_blank" rel="noreferrer">NOAA/NWS radar service</a>
                    <a className="text-cyan-300 underline" href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {summary?.status === 'ready' && !hero && (
          <div className="mt-4 space-y-3">
            <h3 className="font-bold text-white">Active NWS alerts ({summary.alerts?.length ?? 'Unknown'})</h3>
            {summary.alerts?.length ? summary.alerts.map((alert) => (
              <article key={alert.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-red-500/15 px-2 py-1 text-xs font-bold text-red-200">{alert.severity}</span><h4 className="font-semibold text-white">{alert.headline}</h4></div>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{alert.description.slice(0, 500)}{alert.description.length > 500 ? '…' : ''}</p>
                <p className="mt-2 text-xs text-slate-400">Urgency: {alert.urgency} · Certainty: {alert.certainty} · Expires: {alert.expiresAt ? checkedTime(alert.expiresAt) : 'Unknown'}</p>
                <a className="mt-2 inline-block text-xs text-cyan-300 underline" href={safeNwsUrl(alert.sourceUrl)} target="_blank" rel="noreferrer">Open official NWS alert</a>
              </article>
            )) : <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No active alerts were returned for this location in the checked NWS response. This does not assess damage or date of loss.</p>}
          </div>
        )}

        <div className={`${hero ? 'mt-auto pt-5' : 'mt-4'} flex items-center gap-3 border-t border-white/15 pt-3`}>
          <span className="shrink-0 rounded bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white">Live</span>
          <div className="min-w-0 flex-1 overflow-hidden" role="status" aria-live="polite" aria-label="Live weather and workspace ticker">
            <div className={`roofos-live-ticker flex min-w-max items-center gap-10 whitespace-nowrap text-xs font-semibold text-slate-200 ${tickerPaused ? 'roofos-live-ticker-paused' : ''}`}>
              <span>{tickerContent}</span><span aria-hidden="true">{tickerContent}</span>
            </div>
          </div>
          <button type="button" onClick={() => setTickerPaused((value) => !value)} aria-pressed={tickerPaused} className="shrink-0 rounded border border-white/20 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10">
            {tickerPaused ? 'Resume ticker' : 'Pause ticker'}
          </button>
        </div>
      </div>
    </section>
  )
}
