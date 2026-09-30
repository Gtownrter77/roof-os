// National Weather Service API - Free, no API key required

const NWS_API = 'https://api.weather.gov'
const NWS_HEADERS = {
  Accept: 'application/geo+json, application/json',
  'User-Agent': 'ROOF-OS/1.0 (https://github.com/Gtownrter77/roof-os)',
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
  zones: string[]
}

export interface Forecast {
  temperature: number
  conditions: string
  icon: string
}

export async function getAlerts(state: string = 'GA'): Promise<WeatherAlert[]> {
  try {
    if (!/^[A-Z]{2}$/.test(state)) return []
    const response = await fetchNws(`${NWS_API}/alerts/active?area=${state}`)
    if (!response.ok) throw new Error('Failed to fetch alerts')
    const data = await response.json() as { features?: Array<{ id?: string; properties?: Record<string, any> }> }
    
    return (Array.isArray(data.features) ? data.features : []).slice(0, 100).map((feature) => ({
      id: feature.id ?? '',
      headline: feature.properties?.headline || feature.properties?.event || 'Weather alert',
      description: feature.properties?.description || '',
      severity: feature.properties?.severity || 'Unknown',
      urgency: feature.properties?.urgency || 'Unknown',
      certainty: feature.properties?.certainty || 'Unknown',
      expiresAt: feature.properties?.expires || '',
      zones: Array.isArray(feature.properties?.affectedZones) ? feature.properties.affectedZones.slice(0, 100) : []
    })) || []
  } catch (error) {
    console.error('Weather API Error:', error)
    return []
  }
}

export async function getForecast(lat: number = 33.7490, lon: number = -84.3880): Promise<Forecast | null> {
  try {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) return null
    // First get the forecast office
    const pointsRes = await fetchNws(`${NWS_API}/points/${lat},${lon}`)
    if (!pointsRes.ok) throw new Error('Failed to get forecast points')
    const pointsData = await pointsRes.json() as { properties?: { forecast?: string } }
    
    const forecastUrl = pointsData.properties?.forecast
    if (!forecastUrl) throw new Error('No forecast URL found')
    const forecast = new URL(forecastUrl)
    if (forecast.origin !== NWS_API || !forecast.pathname.startsWith('/gridpoints/')) throw new Error('NWS returned an untrusted forecast URL')
    
    const forecastRes = await fetchNws(forecast.toString())
    if (!forecastRes.ok) throw new Error('Failed to fetch forecast')
    const forecastData = await forecastRes.json() as { properties?: { periods?: Array<{ temperature?: number; shortForecast?: string; icon?: string }> } }
    
    const period = forecastData.properties?.periods?.[0]
    if (!period) throw new Error('No forecast period found')
    
    return {
      temperature: period.temperature || 0,
      conditions: period.shortForecast || 'Unknown',
      icon: period.icon || ''
    }
  } catch (error) {
    console.error('Forecast API Error:', error)
    return null
  }
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    'Extreme': 'bg-red-600 text-white',
    'Severe': 'bg-orange-500 text-white',
    'Moderate': 'bg-yellow-500 text-white',
    'Minor': 'bg-blue-500 text-white',
    'Unknown': 'bg-gray-500 text-white'
  }
  return colors[severity] || 'bg-gray-500 text-white'
}

export function getUrgencyLabel(urgency: string): string {
  const labels: Record<string, string> = {
    'Immediate': '🔴 Immediate Action',
    'Expected': '🟡 Expected',
    'Future': '🟢 Future',
    'Past': '⚪ Past',
    'Unknown': '⚪ Unknown'
  }
  return labels[urgency] || '⚪ Unknown'
}
