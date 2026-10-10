'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WeatherRadarMap from '../../components/WeatherRadarMap'
import type { WeatherAlert } from '../../lib/services/weather'

type Summary = {
  status: 'ready' | 'location_missing'
  checkedAt?: string
  location?: { postalCode: string; label: string; latitude: number; longitude: number; source: string }
  alerts?: WeatherAlert[]
  forecast?: { period: string; temperature: number; temperatureUnit: string; conditions: string } | null
  error?: string
  message?: string
}

const REFRESH_MS = 3 * 60 * 1000

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
  const [opacity, setOpacity] = useState(0.82)
  const [refreshTick, setRefreshTick] = useState(0)
  const [locating, setLocating] = useState(false)
  const [coordsOverride, setCoordsOverride] = useState<{ latitude: number; longitude: number } | null>(null)

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

  useEffect(() => {
    const query = coordsOverride
      ? `?latitude=${encodeURIComponent(String(coordsOverride.latitude))}&longitude=${encodeURIComponent(String(coordsOverride.longitude))}`
      : ''
    void load(query)
  }, [load, coordsOverride, refreshTick])

  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((n) => n + 1), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault()
        setChrome((v) => !v)
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
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 60_000,
        })
      })
      setCoordsOverride({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Device location could not be used.')
    } finally {
      setLocating(false)
    }
  }

  const location = summary?.status === 'ready' ? summary.location : null
  const alerts = summary?.alerts ?? []
  const refreshKey = `${summary?.checkedAt ?? 'na'}-${refreshTick}-${opacity}`

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      {location ? (
        <WeatherRadarMap
          latitude={location.latitude}
          longitude={location.longitude}
          locationLabel={location.label}
          refreshKey={refreshKey}
          zoom={7.2}
          opacity={opacity}
          edgeToEdge
          showBadge={false}
          className="h-full w-full rounded-none border-0"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#050914] p-6">
          <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-950/90 p-6 text-center">
            <h1 className="text-2xl font-black">Radar cinema</h1>
            {loading && <p className="text-sm text-slate-400">Loading NOAA / workspace location…</p>}
            {error && <p className="text-sm text-amber-200" role="alert">{error}</p>}
            {summary?.status === 'location_missing' && (
              <p className="text-sm text-slate-300">
                Set the workspace service ZIP in Settings, or share device location to center the radar.
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

      {/* Top HUD */}
      {chrome && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pb-16">
          <div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">ROOF/OS · radar cinema</p>
              <h1 className="text-xl font-black md:text-2xl">
                {location ? `${location.label} · ${location.postalCode}` : 'NOAA MRMS'}
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                Live composite reflectivity · refreshed {checkedLabel(summary?.checkedAt)} · auto every 3 min
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRefreshTick((n) => n + 1)}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void useDeviceLocation()}
                disabled={locating}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                {locating ? 'Locating…' : 'My location'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const root = document.documentElement
                  if (!document.fullscreenElement) void root.requestFullscreen?.()
                  else void document.exitFullscreen?.()
                }}
                className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
              >
                Browser fullscreen
              </button>
              <button
                type="button"
                onClick={() => setChrome(false)}
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Hide HUD (H)
              </button>
              <Link
                href="/weather"
                className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Exit
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom HUD */}
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
                Keys: H hide HUD · F browser fullscreen · R refresh · Esc exit · Radar: NOAA/NWS MRMS · not a damage assessment
              </p>
            </div>
            <label className="flex min-w-[200px] flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-400">
              Radar opacity
              <input
                type="range"
                min={0.35}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full"
              />
            </label>
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
