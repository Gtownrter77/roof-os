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
  const admin = createAdminClient()

  const [databaseResult, storageResult, weather] = await Promise.all([
    admin.from('workspaces').select('id').limit(1),
    admin.storage.from('inspection-photos').list('', { limit: 1 }),
    checkWeather(),
  ])

  const database: ServiceStatus = databaseResult.error ? 'offline' : 'online'
  const storage: ServiceStatus = storageResult.error ? 'offline' : 'online'
  const api: ServiceStatus = 'online'
  const services = { database, api, weather, storage }
  const operational = Object.values(services).every((value) => value === 'online')

  // Booleans only — never echo secret values.
  const ai = {
    textProvider: process.env.XAI_API_KEY?.trim()
      ? 'spacexai'
      : process.env.OLLAMA_HOST?.trim()
        ? 'ollama_only'
        : 'none',
    visionConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
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
