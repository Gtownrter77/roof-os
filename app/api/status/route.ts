import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ServiceStatus = 'online' | 'offline' | 'unknown'

async function checkWeather(): Promise<ServiceStatus> {
  try {
    const response = await fetch('https://api.weather.gov/', {
      headers: { 'User-Agent': 'ROOF-OS status check' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

export async function GET() {
  const started = Date.now()
  let database: ServiceStatus = 'unknown'
  let storage: ServiceStatus = 'unknown'
  try {
    const admin = createAdminClient()
    const [databaseResult, storageResult] = await Promise.all([
      admin.from('workspaces').select('id').limit(1),
      admin.storage.from('inspection-photos').list('', { limit: 1 }),
    ])
    database = databaseResult.error ? 'offline' : 'online'
    storage = storageResult.error ? 'offline' : 'online'
  } catch {
    // Health reporting must remain available while deployment secrets are being configured.
    // The missing server key is represented as unknown rather than a route-level 500.
  }
  const weather = await checkWeather()
  const api: ServiceStatus = 'online'
  const services = { database, api, weather, storage }
  const operational = Object.values(services).every((value) => value === 'online')

  // Booleans only — never echo secret values.
  const ai = {
    textProvider: process.env.OLLAMA_HOST?.trim() ? 'ollama' : 'keywords',
    visionConfigured: Boolean(process.env.OLLAMA_VISION_API_BASE_URL?.trim()),
    cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    capoutConfigured: Boolean(process.env.CAPOUT_API_KEY?.trim()),
    whisperConfigured: Boolean(
      process.env.WHISPER_URL?.trim() || process.env.WHISPER_WORKER_URL?.trim(),
    ),
  }

  return NextResponse.json({
    overall: operational ? 'operational' : 'degraded',
    services,
    ai,
    uptime: 'not_measured',
    checkedAt: new Date().toISOString(),
    responseMs: Date.now() - started,
  }, { headers: { 'cache-control': 'no-store' } })
}
