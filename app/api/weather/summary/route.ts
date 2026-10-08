import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, isUuid, requireWorkspaceMember } from '../../../../lib/api-security'
import { getAlertsAtPoint, getForecast } from '../../../../lib/services/weather'
import { getRadarServiceForPoint } from '../../../../lib/services/radar-source.mjs'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ROOF-OS/1.0 (https://github.com/Gtownrter77/roof-os)',
}
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000
const GEOCODE_CACHE = new Map<string, { expiresAt: number; value: GeocodedLocation }>()
const GEOCODE_IN_FLIGHT = new Map<string, Promise<GeocodedLocation>>()
let lastNominatimRequest = 0

type GeocodedLocation = { latitude: number; longitude: number; address: Record<string, unknown>; label: string }

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE })
}

function labelFromAddress(address: Record<string, unknown>, fallbackZip: string) {
  const city = [address.city, address.town, address.village, address.hamlet].find((value) => typeof value === 'string')
  const stateCode = typeof address['ISO3166-2-lvl4'] === 'string'
    ? String(address['ISO3166-2-lvl4']).split('-').at(-1)
    : null
  const state = typeof address.state === 'string' ? address.state : null
  const place = typeof city === 'string' ? city : typeof address.county === 'string' ? address.county : null
  return [place, stateCode ?? state].filter(Boolean).join(', ') || fallbackZip
}

async function geocodeZip(zip: string): Promise<GeocodedLocation> {
  const cached = GEOCODE_CACHE.get(zip)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const inFlight = GEOCODE_IN_FLIGHT.get(zip)
  if (inFlight) return inFlight

  const lookup = (async () => {
    // Nominatim asks clients to identify themselves and avoid burst traffic.
    const now = Date.now()
    const scheduledAt = Math.max(now, lastNominatimRequest + 1_100)
    lastNominatimRequest = scheduledAt
    if (scheduledAt > now) await new Promise((resolve) => setTimeout(resolve, scheduledAt - now))

    const url = new URL(NOMINATIM)
    url.searchParams.set('postalcode', zip)
    url.searchParams.set('country', 'United States')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '1')
    const geocodeResponse = await fetchWithTimeout(url, { headers: NOMINATIM_HEADERS, cache: 'no-store' }, 8_000)
    if (!geocodeResponse.ok) throw new Error('OpenStreetMap geocoding is unavailable.')
    const results = await geocodeResponse.json() as Array<{ lat?: string; lon?: string; address?: Record<string, unknown> }>
    const result = Array.isArray(results) ? results[0] : undefined
    const latitude = Number(result?.lat)
    const longitude = Number(result?.lon)
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('The saved service ZIP could not be resolved to a valid location.')
    }
    const address = result?.address ?? {}
    const location = { latitude, longitude, address, label: labelFromAddress(address, zip) }
    GEOCODE_CACHE.set(zip, { expiresAt: Date.now() + GEOCODE_TTL_MS, value: location })
    return location
  })()

  GEOCODE_IN_FLIGHT.set(zip, lookup)
  try {
    return await lookup
  } finally {
    GEOCODE_IN_FLIGHT.delete(zip)
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return response({ error: 'Authentication required.' }, 401)

    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !isUuid(workspaceId)) return response({ error: 'Workspace could not be verified.' }, 403)
    const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
    if (membership.response) return membership.response

    const { data: settings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('default_zipcode')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (settingsError) return response({ error: 'Workspace weather settings could not be loaded.' }, 503)

    const zip = typeof settings?.default_zipcode === 'string' ? settings.default_zipcode.trim() : ''
    if (!/^\d{5}$/.test(zip)) return response({ status: 'location_missing', message: 'Set a five-digit service-area ZIP in Settings to load local weather.' })

    let location: GeocodedLocation
    try {
      location = await geocodeZip(zip)
    } catch {
      return response({ error: 'OpenStreetMap could not resolve the saved service ZIP. Weather is not shown.' }, 502)
    }

    const [alertsResult, forecast] = await Promise.allSettled([
      getAlertsAtPoint(location.latitude, location.longitude),
      getForecast(location.latitude, location.longitude),
    ])
    if (alertsResult.status === 'rejected') return response({ error: 'NWS alerts could not be verified. No alert count is assumed.' }, 502)

    const radar = getRadarServiceForPoint(location.latitude, location.longitude)
    return response({
      status: 'ready',
      checkedAt: new Date().toISOString(),
      location: {
        postalCode: zip,
        label: location.label,
        latitude: location.latitude,
        longitude: location.longitude,
        source: 'OpenStreetMap Nominatim postal-code geocoding',
      },
      forecast: forecast.status === 'fulfilled' ? forecast.value : null,
      forecastStatus: forecast.status === 'fulfilled' && forecast.value ? 'available' : 'unknown',
      alerts: alertsResult.value,
      alertSource: 'National Weather Service active alerts at the workspace service-ZIP point',
      radar,
      radarStatus: radar ? 'available' : 'outside_supported_noaa_mrms_coverage',
      sources: {
        forecast: 'https://api.weather.gov/',
        alerts: 'https://api.weather.gov/alerts/active',
        radar: radar?.wmsUrl ?? 'https://www.weather.gov/gis/',
        geocoding: 'https://nominatim.openstreetmap.org/',
      },
    })
  } catch {
    return response({ error: 'Workspace weather could not be verified. No local conditions or alert status are assumed.' }, 502)
  }
}
