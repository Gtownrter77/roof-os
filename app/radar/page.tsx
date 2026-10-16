'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import RadarCinemaMap from '../../components/RadarCinemaMap'
import {
  DEFAULT_RADAR_LAYER_PREFS,
  RADAR_UI_LAYERS,
  STORM_LOOP_MINUTES,
  loadRadarLayerPrefs,
  saveRadarLayerPrefs,
  stormLoopLabel,
  type RadarLayerId,
  type RadarLayerPrefs,
} from '../../lib/radar/cinema-layers'
import type { WeatherAlert } from '../../lib/services/weather'

type Summary = {
  status: 'ready' | 'location_missing'
  checkedAt?: string
  location?: { postalCode: string; label: string; latitude: number; longitude: number; source: string }
  alerts?: WeatherAlert[]
  forecast?: { period: string; temperature: number; temperatureUnit: string; conditions: string } | null
  error?: string
}

const REFRESH_MS = 3 * 60 * 1000

function expiresLabel(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString()
}

function checkedLabel(value?: string) {
  if (!value) return 'time unknown'
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? 'time unknown' : parsed.toLocaleTimeString()
}

export default function RadarCinemaPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chrome, setChrome] = useState(true)
  const [layersOpen, setLayersOpen] = useState(true)
  const [prefs, setPrefs] = useState<RadarLayerPrefs>(DEFAULT_RADAR_LAYER_PREFS)
  const [refreshTick, setRefreshTick] = useState(0)
  const [locating, setLocating] = useState(false)
  const [locationMode, setLocationMode] = useState<'device' | 'workspace'>('device')
  const [coordsOverride, setCoordsOverride] = useState<{ latitude: number; longitude: number } | null>(null)
  const [geoReady, setGeoReady] = useState(false)
  const [loopIndex, setLoopIndex] = useState(STORM_LOOP_MINUTES.length - 1)
  const [loopPaused, setLoopPaused] = useState(false)
  const [alertGeoJson, setAlertGeoJson] = useState<{
    type: 'FeatureCollection'
    features: Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> | null }>
  } | null>(null)

  useEffect(() => {
    setPrefs(loadRadarLayerPrefs())
  }, [])

  useEffect(() => {
    saveRadarLayerPrefs(prefs)
  }, [prefs])

  const load = useCallback(async (query = '') => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/weather/summary${query}`, { cache: 'no-store' })
      const payload = await response.json() as Summary
      if (!response.ok) throw new Error(payload.error ?? 'Weather could not be verified.')
      setSummary(payload)
    } catch (cause) {
      setSummary(null)
      setError(cause instanceof Error ? cause.message : 'Weather could not be verified.')
    } finally {
      setLoading(false)
    }
  }, [])

  const applyDevicePosition = useCallback((position: GeolocationPosition) => {
    setLocationMode('device')
    setCoordsOverride({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    })
  }, [])

  // Localize to the user first — GPS before workspace ZIP.
  useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) {
      setLocationMode('workspace')
      setGeoReady(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return
        applyDevicePosition(position)
        setLocating(false)
        setGeoReady(true)
      },
      () => {
        if (cancelled) return
        // Permission denied / unavailable → fall back to workspace ZIP.
        setLocationMode('workspace')
        setCoordsOverride(null)
        setLocating(false)
        setGeoReady(true)
        setError('Device location unavailable — using workspace service ZIP when set.')
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 30_000,
      },
    )
    return () => { cancelled = true }
  }, [applyDevicePosition])

  useEffect(() => {
    if (!geoReady) return
    const query = coordsOverride
      ? `?latitude=${encodeURIComponent(String(coordsOverride.latitude))}&longitude=${encodeURIComponent(String(coordsOverride.longitude))}`
      : ''
    void load(query)
  }, [load, coordsOverride, refreshTick, geoReady])

  // Active alert polygons for the point (NWS public API)
  useEffect(() => {
    const location = summary?.status === 'ready' ? summary.location : null
    if (!location || !prefs.alerts) {
      setAlertGeoJson(null)
      return
    }
    let cancelled = false
    const url = `https://api.weather.gov/alerts/active?point=${location.latitude},${location.longitude}`
    void fetch(url, {
      headers: { Accept: 'application/geo+json', 'User-Agent': 'ROOF-OS/1.0 (radar-cinema)' },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('alerts unavailable')
        return response.json() as Promise<{ features?: Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> | null }> }>
      })
      .then((collection) => {
        if (cancelled) return
        setAlertGeoJson({
          type: 'FeatureCollection',
          features: (collection.features || []).filter((feature) => Boolean(feature.geometry)),
        })
      })
      .catch(() => {
        if (!cancelled) setAlertGeoJson(null)
      })
    return () => { cancelled = true }
  }, [summary, prefs.alerts, refreshTick])

  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((n) => n + 1), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!prefs.stormLoop || loopPaused) return
    const id = window.setInterval(() => {
      setLoopIndex((index) => (index + 1) % STORM_LOOP_MINUTES.length)
    }, 800)
    return () => window.clearInterval(id)
  }, [prefs.stormLoop, loopPaused])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault()
        setChrome((v) => !v)
      }
      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault()
        setLayersOpen((v) => !v)
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        const root = document.documentElement
        if (!document.fullscreenElement) void root.requestFullscreen?.()
        else void document.exitFullscreen?.()
      }
      if (event.key === 'Escape' && !document.fullscreenElement) {
        router.push('/weather')
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault()
        setRefreshTick((n) => n + 1)
      }
      if (event.key === 'p' || event.key === 'P' || event.key === ' ') {
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
        event.preventDefault()
        setPrefs((prev) => {
          if (!prev.stormLoop) {
            setLoopPaused(false)
            setLoopIndex(0)
            return { ...prev, stormLoop: true }
          }
          setLoopPaused((paused) => !paused)
          return prev
        })
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('roofos-radar-view', { detail: 'expand' }))
      }
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('roofos-radar-view', { detail: 'localize' }))
      }
      if (event.key === '0') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('roofos-radar-view', { detail: 'expand-max' }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  async function useDeviceLocation() {
    if (!navigator.geolocation) {
      setError('This browser cannot share a location for NOAA radar.')
      return
    }
    setLocating(true)
    setError(null)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 15_000,
        })
      })
      applyDevicePosition(position)
      setRefreshTick((n) => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Device location could not be used.')
    } finally {
      setLocating(false)
    }
  }

  function useWorkspaceLocation() {
    setLocationMode('workspace')
    setCoordsOverride(null)
    setError(null)
    setRefreshTick((n) => n + 1)
  }

  function toggleLayer(id: RadarLayerId) {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const location = summary?.status === 'ready' ? summary.location : null
  const alerts = summary?.alerts ?? []
  const refreshKey = `${summary?.checkedAt ?? 'na'}-${refreshTick}`
  const activeRadarCount = (['bref', 'cref', 'echoTops', 'precipType'] as const).filter((id) => prefs[id]).length

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      {location ? (
        <RadarCinemaMap
          latitude={location.latitude}
          longitude={location.longitude}
          locationLabel={location.label}
          prefs={prefs}
          refreshKey={refreshKey}
          alerts={alerts}
          alertGeoJson={alertGeoJson}
          loopMinutesAgo={prefs.stormLoop ? STORM_LOOP_MINUTES[loopIndex] : null}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#050914] p-6">
          <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-950/90 p-6 text-center">
            <h1 className="text-2xl font-black">Radar cinema</h1>
            {loading || locating || !geoReady ? (
              <p className="text-sm text-slate-400">Localizing radar to your location…</p>
            ) : null}
            {error && <p className="text-sm text-amber-200" role="alert">{error}</p>}
            {summary?.status === 'location_missing' && (
              <p className="text-sm text-slate-300">
                Allow location access, or set a workspace service ZIP in Settings.
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void useDeviceLocation()}
                disabled={locating}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {locating ? 'Locating…' : 'Use my location'}
              </button>
              <Link href="/settings" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200">
                Settings
              </Link>
              <Link href="/weather" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200">
                Weather
              </Link>
            </div>
          </div>
        </div>
      )}

      {chrome && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pb-16">
          <div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">ROOF/OS · radar cinema</p>
              <h1 className="text-xl font-black md:text-2xl">
                {location ? `${location.label}${location.postalCode ? ` · ${location.postalCode}` : ''}` : 'NOAA MRMS'}
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                {locationMode === 'device' ? 'Localized to you' : 'Workspace service ZIP'}
                {' · '}
                {activeRadarCount} MRMS product{activeRadarCount === 1 ? '' : 's'}
                {prefs.stormLoop ? ` · loop ${stormLoopLabel(STORM_LOOP_MINUTES[loopIndex])}` : ''}
                {' · '}
                refreshed {checkedLabel(summary?.checkedAt)} · auto 3 min
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRefreshTick((n) => n + 1)} className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Refresh</button>
              <button type="button" onClick={() => void useDeviceLocation()} disabled={locating} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${locationMode === 'device' ? 'border-cyan-400/50 bg-cyan-400/20 text-cyan-100' : 'border-white/20 bg-black/50 hover:bg-white/10'}`}>{locating ? 'Locating…' : 'My location'}</button>
              <button type="button" onClick={useWorkspaceLocation} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${locationMode === 'workspace' ? 'border-cyan-400/50 bg-cyan-400/20 text-cyan-100' : 'border-white/20 bg-black/50 hover:bg-white/10'}`}>Workspace ZIP</button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('roofos-radar-view', { detail: 'expand' }))} className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Expand</button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('roofos-radar-view', { detail: 'expand-max' }))} className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Expand max</button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('roofos-radar-view', { detail: 'localize' }))} className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Local</button>
              <button
                type="button"
                onClick={() => {
                  setPrefs((prev) => ({ ...prev, stormLoop: !prev.stormLoop }))
                  setLoopPaused(false)
                  setLoopIndex(0)
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${prefs.stormLoop ? 'border-cyan-400/50 bg-cyan-400/20 text-cyan-100' : 'border-white/20 bg-black/50 hover:bg-white/10'}`}
              >
                {prefs.stormLoop ? (loopPaused ? 'Loop paused' : `Loop · ${stormLoopLabel(STORM_LOOP_MINUTES[loopIndex])}`) : 'Storm loop'}
              </button>
              {prefs.stormLoop && (
                <button type="button" onClick={() => setLoopPaused((paused) => !paused)} className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                  {loopPaused ? 'Play' : 'Pause'}
                </button>
              )}
              <button type="button" onClick={() => setLayersOpen((v) => !v)} className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-100">Layers (L)</button>
              <button
                type="button"
                onClick={() => {
                  const root = document.documentElement
                  if (!document.fullscreenElement) void root.requestFullscreen?.()
                  else void document.exitFullscreen?.()
                }}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Fullscreen (F)
              </button>
              <button type="button" onClick={() => setChrome(false)} className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Hide HUD (H)</button>
              <Link href="/settings" className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Settings</Link>
              <Link href="/weather" className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Exit</Link>
              <Link href="/inspections" className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-100">Walk the roof</Link>
            </div>
          </div>
        </div>
      )}

      {/* Layer panel */}
      {chrome && layersOpen && (
        <aside className="absolute right-3 top-28 z-20 w-[min(100%-1.5rem,320px)] rounded-2xl border border-white/15 bg-slate-950/92 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-cyan-200">Layers</h2>
            <button type="button" onClick={() => setLayersOpen(false)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          <div className="space-y-2">
            {RADAR_UI_LAYERS.map((layer) => (
              <label key={layer.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5 hover:border-cyan-400/30">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(prefs[layer.id])}
                  onChange={() => toggleLayer(layer.id)}
                />
                <span>
                  <span className="block text-sm font-semibold text-white">{layer.label}</span>
                  <span className="block text-[11px] text-slate-400">{layer.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
            <label className="block text-[10px] uppercase tracking-wide text-slate-400">
              Radar opacity · {Math.round(prefs.radarOpacity * 100)}%
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={prefs.radarOpacity}
                onChange={(e) => setPrefs((p) => ({ ...p, radarOpacity: Number(e.target.value) }))}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[10px] uppercase tracking-wide text-slate-400">
              Alert fill opacity · {Math.round(prefs.alertsOpacity * 100)}%
              <input
                type="range"
                min={0.1}
                max={0.8}
                step={0.05}
                value={prefs.alertsOpacity}
                onChange={(e) => setPrefs((p) => ({ ...p, alertsOpacity: Number(e.target.value) }))}
                className="mt-1 w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => setPrefs({ ...DEFAULT_RADAR_LAYER_PREFS })}
              className="w-full rounded-lg border border-white/15 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
            >
              Reset to defaults
            </button>
            <p className="text-[10px] text-slate-500">
              Saved on this device. Same toggles live under Settings → Radar cinema layers.
            </p>
          </div>
        </aside>
      )}

      {chrome && location && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-20">
          <div className="pointer-events-auto mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl space-y-2">
              {summary?.forecast && (
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-white">{summary.forecast.period}</span>
                  {' · '}
                  {summary.forecast.temperature}°{summary.forecast.temperatureUnit}
                  {' · '}
                  {summary.forecast.conditions}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {alerts.length === 0 && (
                  <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-slate-300">
                    No active NWS alerts in this check
                  </span>
                )}
                {alerts.slice(0, 4).map((alert) => (
                  <span
                    key={alert.id}
                    className="rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100"
                    title={alert.headline}
                  >
                    {alert.headline}
                  </span>
                ))}
                {alerts.length > 4 && (
                  <Link href="/storms" className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200">
                    +{alerts.length - 4} more
                  </Link>
                )}
              </div>
              <p className="text-[10px] text-slate-500">
                Keys: L layers · P or Space loop · H HUD · F fullscreen · R refresh · − expand · + local · 0 expand max · Esc exit · pinch/scroll zooms 0–18 · NOAA/NWS and IEM · not a damage assessment
              </p>
            </div>
            <div className="max-w-sm space-y-2">
              {alerts.length > 0 && (
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-amber-400/30 bg-black/55 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200">Storm desk · {alerts.length} active</p>
                  {alerts.slice(0, 3).map((alert) => (
                    <article key={alert.id}>
                      <p className="text-xs font-semibold text-amber-50">{alert.headline}</p>
                      <p className="text-[10px] text-slate-400">
                        {alert.severity} · {alert.urgency}
                        {alert.expiresAt ? ` · until ${expiresLabel(alert.expiresAt)}` : ''}
                      </p>
                      {alert.description ? (
                        <p className="line-clamp-2 text-[11px] text-slate-300">{alert.description}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[10px] text-slate-300">
                <p className="font-bold uppercase tracking-wide text-slate-200">Legend</p>
                <div className="mt-1 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#64748b,#22c55e,#84cc16,#eab308,#f97316,#ef4444,#7f1d1d)' }} />
                <p className="mt-1">Light returns through heavy and severe. Amber polygons are NWS alert areas.</p>
                <p>Storm loop is the last hour of NEXRAD in 5-minute steps. It stands in for base reflectivity while it plays.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!chrome && (
        <button
          type="button"
          onClick={() => setChrome(true)}
          className="absolute bottom-4 left-4 z-10 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-slate-200"
        >
          Show HUD (H)
        </button>
      )}

      {error && location && (
        <div className="absolute left-1/2 top-20 z-20 max-w-md -translate-x-1/2 rounded-lg border border-amber-400/40 bg-slate-950/90 px-3 py-2 text-xs text-amber-100" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
