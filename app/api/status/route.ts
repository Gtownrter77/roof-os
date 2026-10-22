import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ServiceStatus = 'online' | 'offline' | 'unknown'
type WorkerHealth = { status: 'healthy' | 'degraded' | 'unknown'; configured: number; stale: number; queryError: boolean }

// Cache weather health probe for 30s to prevent spamming NWS
let cachedWeatherStatus: { status: ServiceStatus; expiresAt: number } = { status: 'unknown', expiresAt: 0 }

async function checkWeather(): Promise<ServiceStatus> {
  const now = Date.now()
  if (cachedWeatherStatus.expiresAt > now) {
    return cachedWeatherStatus.status
  }

  try {
    const response = await fetch('https://api.weather.gov/', {
      headers: { 'User-Agent': 'ROOF-OS status check' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    const status = response.ok ? 'online' : 'offline'
    cachedWeatherStatus = { status, expiresAt: now + 30_000 }
    return status
  } catch {
    cachedWeatherStatus = { status: 'offline', expiresAt: now + 15_000 }
    return 'offline'
  }
}

export async function GET() {
  const started = Date.now()
  let database: ServiceStatus = 'unknown'
  let storage: ServiceStatus = 'unknown'
  let workerHealth: WorkerHealth = { status: 'unknown', configured: 0, stale: 0, queryError: false }

  const weatherPromise = checkWeather()

  try {
    const admin = createAdminClient()
    const [databaseResult, storageResult, workerResult] = await Promise.all([
      admin.from('workspaces').select('id').limit(1),
      admin.storage.from('inspection-photos').list('', { limit: 1 }),
      admin.from('agent_worker_heartbeats').select('status,last_seen_at').order('last_seen_at', { ascending: false }).limit(100),
    ])

    database = databaseResult.error ? 'offline' : 'online'
    storage = storageResult.error ? 'offline' : 'online'

    if (workerResult.error) {
      workerHealth = { status: 'unknown', configured: 0, stale: 0, queryError: true }
    } else if (workerResult.data?.length) {
      const cutoff = Date.now() - 15 * 60 * 1000
      const stale = workerResult.data.filter((worker) => worker.status !== 'healthy' || new Date(worker.last_seen_at).getTime() < cutoff).length
      workerHealth = { status: stale ? 'degraded' : 'healthy', configured: workerResult.data.length, stale, queryError: false }
    }
  } catch {
    // Health reporting must remain available while deployment secrets are being configured.
    // The missing server key is represented as unknown rather than a route-level 500.
    workerHealth = { status: 'unknown', configured: 0, stale: 0, queryError: true }
  }

  const weather = await weatherPromise
  const api: ServiceStatus = 'online'
  const services = { database, api, weather, storage }
  const operational = Object.values(services).every((value) => value === 'online')

  // Booleans only — never echo secret values.
  const ai = {
    textProvider: process.env.OLLAMA_HOST?.trim() ? 'ollama' : 'keywords',
    visionConfigured: Boolean(process.env.OLLAMA_VISION_API_BASE_URL?.trim()),
    cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    capoutConfigured: Boolean(process.env.CAPOUT_API_KEY?.trim()),
    localClaimsConfigured: Boolean(process.env.CLAIMS_DOCUMENT_WORKER_URL?.trim()),
    whisperConfigured: Boolean(
      process.env.WHISPER_URL?.trim() || process.env.WHISPER_WORKER_URL?.trim(),
    ),
  }

  const configWarnings: string[] = []
  const visionEndpoint = process.env.OLLAMA_VISION_API_BASE_URL?.trim() || ''
  if (process.env.NODE_ENV === 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(visionEndpoint)) {
    configWarnings.push('vision_endpoint_is_localhost_in_production')
  }
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    configWarnings.push('supabase_public_url_missing')
  }
  if (process.env.CRON_SECRET?.trim() && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    configWarnings.push('cron_secret_present_without_service_role')
  }

  return NextResponse.json({
    overall: operational ? 'operational' : 'degraded',
    services,
    ai,
    workers: workerHealth,
    configWarnings,
    uptime: 'not_measured',
    checkedAt: new Date().toISOString(),
    responseMs: Date.now() - started,
  }, { headers: { 'cache-control': 'no-store' } })
}
