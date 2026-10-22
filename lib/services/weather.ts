// National Weather Service API: public, no API key required.
const NWS_API = 'https://api.weather.gov'
const NWS_HEADERS = {
  Accept: 'application/geo+json, application/json',
  'User-Agent': 'ROOF-OS/1.0 (https://github.com/Gtownrter77/roof-os)',
}

// In-memory caches to eliminate redundant external round-trips
const POINT_META_CACHE = new Map<string, { expiresAt: number; value: { forecastUrl?: string; relativeLocation?: string | null } }>()
const FORECAST_CACHE = new Map<string, { expiresAt: number; value: Forecast | null }>()
const ALERTS_CACHE = new Map<string, { expiresAt: number; value: WeatherAlert[] }>()
const IN_FLIGHT_REQUESTS = new Map<string, Promise<any>>()

const POINT_TTL_MS = 15 * 60 * 1000 // 15 minutes for static radar/gridpoints metadata
const FORECAST_TTL_MS = 10 * 60 * 1000 // 10 minutes for forecast periods
const ALERTS_TTL_MS = 2 * 60 * 1000 // 2 minutes for active emergency weather alerts

function quantizeKey(lat: number, lon: number): string {
  // Quantize coordinates to 2 decimal places (~1.1 km precision) to group close queries
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

async function fetchNws(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    return await fetch(url, { headers: NWS_HEADERS, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timeout)
  }
}

export interface WeatherAlert {
  id: string
  headline: string
  description: string
  severity: string
  urgency: string
  certainty: string
  expiresAt: string
  sourceUrl: string
}

export interface Forecast {
  temperature: number
  temperatureUnit: string
  conditions: string
  period: string
}

function validPoint(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

function mapAlert(feature: { id?: string; properties?: Record<string, unknown> }, index: number, fallbackUrl: string): WeatherAlert {
  const properties = feature.properties ?? {}
  const text = (key: string, fallback: string) => typeof properties[key] === 'string' && properties[key]
    ? String(properties[key])
    : fallback
  return {
    id: feature.id ?? `nws-alert-${index}`,
    headline: text('headline', text('event', 'Weather alert')),
    description: text('description', 'No alert description was provided.'),
    severity: text('severity', 'Unknown'),
    urgency: text('urgency', 'Unknown'),
    certainty: text('certainty', 'Unknown'),
    expiresAt: text('expires', ''),
    sourceUrl: feature.id ?? fallbackUrl,
  }
}

/** Fetch active alerts for this point. Network/API failure throws, never masquerades as zero alerts. */
export async function getAlertsAtPoint(latitude: number, longitude: number): Promise<WeatherAlert[]> {
  if (!validPoint(latitude, longitude)) throw new Error('A valid location is required for local alerts.')
  
  const key = quantizeKey(latitude, longitude)
  const cached = ALERTS_CACHE.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const inFlight = IN_FLIGHT_REQUESTS.get(`alerts:${key}`)
  if (inFlight) return inFlight

  const task = (async () => {
    const url = new URL(`${NWS_API}/alerts/active`)
    url.searchParams.set('point', `${latitude},${longitude}`)
    const response = await fetchNws(url.toString())
    if (!response.ok) throw new Error('National Weather Service alerts are unavailable.')
    const data = await response.json() as { features?: Array<{ id?: string; properties?: Record<string, unknown> }> }
    const result = (Array.isArray(data.features) ? data.features : []).slice(0, 100).map((feature, index) => mapAlert(feature, index, url.toString()))
    ALERTS_CACHE.set(key, { expiresAt: Date.now() + ALERTS_TTL_MS, value: result })
    return result
  })()

  IN_FLIGHT_REQUESTS.set(`alerts:${key}`, task)
  try {
    return await task
  } finally {
    IN_FLIGHT_REQUESTS.delete(`alerts:${key}`)
  }
}

async function getPointMetadata(latitude: number, longitude: number) {
  const key = quantizeKey(latitude, longitude)
  const cached = POINT_META_CACHE.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const inFlight = IN_FLIGHT_REQUESTS.get(`point:${key}`)
  if (inFlight) return inFlight

  const task = (async () => {
    const response = await fetchNws(`${NWS_API}/points/${latitude},${longitude}`)
    if (!response.ok) return { forecastUrl: undefined, relativeLocation: null }
    const data = await response.json() as {
      properties?: {
        forecast?: string
        relativeLocation?: { properties?: { city?: string; state?: string } }
      }
    }
    const relative = data.properties?.relativeLocation?.properties
    const relativeLocation = relative?.city && relative?.state ? `${relative.city}, ${relative.state}` : null
    const forecastUrl = data.properties?.forecast
    const value = { forecastUrl, relativeLocation }
    POINT_META_CACHE.set(key, { expiresAt: Date.now() + POINT_TTL_MS, value })
    return value
  })()

  IN_FLIGHT_REQUESTS.set(`point:${key}`, task)
  try {
    return await task
  } finally {
    IN_FLIGHT_REQUESTS.delete(`point:${key}`)
  }
}

/** Resolve a display label through NWS metadata without using or storing a street address. */
export async function getNwsRelativeLocation(latitude: number, longitude: number): Promise<string | null> {
  if (!validPoint(latitude, longitude)) return null
  try {
    const meta = await getPointMetadata(latitude, longitude)
    return meta.relativeLocation
  } catch {
    return null
  }
}

/** Return the next official NWS forecast period for an explicit point. */
export async function getForecast(latitude: number, longitude: number): Promise<Forecast | null> {
  if (!validPoint(latitude, longitude)) return null
  
  const key = quantizeKey(latitude, longitude)
  const cached = FORECAST_CACHE.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const inFlight = IN_FLIGHT_REQUESTS.get(`forecast:${key}`)
  if (inFlight) return inFlight

  const task = (async () => {
    try {
      const meta = await getPointMetadata(latitude, longitude)
      const forecastUrl = meta.forecastUrl
      if (!forecastUrl) return null
      const forecast = new URL(forecastUrl)
      if (forecast.origin !== NWS_API || !forecast.pathname.startsWith('/gridpoints/')) return null
      const forecastRes = await fetchNws(forecast.toString())
      if (!forecastRes.ok) return null
      const forecastData = await forecastRes.json() as { properties?: { periods?: Array<{ name?: string; temperature?: number; temperatureUnit?: string; shortForecast?: string }> } }
      const period = forecastData.properties?.periods?.[0]
      if (!period || typeof period.temperature !== 'number') return null
      const result: Forecast = {
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit ?? 'F',
        conditions: period.shortForecast || 'Unknown',
        period: period.name || 'Next forecast period',
      }
      FORECAST_CACHE.set(key, { expiresAt: Date.now() + FORECAST_TTL_MS, value: result })
      return result
    } catch {
      return null
    }
  })()

  IN_FLIGHT_REQUESTS.set(`forecast:${key}`, task)
  try {
    return await task
  } finally {
    IN_FLIGHT_REQUESTS.delete(`forecast:${key}`)
  }
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    Extreme: 'bg-red-600 text-white',
    Severe: 'bg-orange-500 text-white',
    Moderate: 'bg-yellow-500 text-gray-950',
    Minor: 'bg-blue-500 text-white',
    Unknown: 'bg-gray-500 text-white',
  }
  return colors[severity] || 'bg-gray-500 text-white'
}

export function getUrgencyLabel(urgency: string): string {
  const labels: Record<string, string> = {
    Immediate: 'Immediate action',
    Expected: 'Expected',
    Future: 'Future',
    Past: 'Past',
    Unknown: 'Unknown urgency',
  }
  return labels[urgency] || 'Unknown urgency'
}
