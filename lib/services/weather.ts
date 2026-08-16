// National Weather Service API - Free, no API key required

const NWS_API = 'https://api.weather.gov'

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
    const response = await fetch(`${NWS_API}/alerts/active?area=${state}`)
    if (!response.ok) throw new Error('Failed to fetch alerts')
    const data = await response.json()
    
    return data.features?.map((feature: any) => ({
      id: feature.id,
      headline: feature.properties.headline || feature.properties.event,
      description: feature.properties.description || '',
      severity: feature.properties.severity || 'Unknown',
      urgency: feature.properties.urgency || 'Unknown',
      certainty: feature.properties.certainty || 'Unknown',
      expiresAt: feature.properties.expires,
      zones: feature.properties.affectedZones || []
    })) || []
  } catch (error) {
    console.error('Weather API Error:', error)
    return []
  }
}

export async function getForecast(lat: number = 33.7490, lon: number = -84.3880): Promise<Forecast | null> {
  try {
    // First get the forecast office
    const pointsRes = await fetch(`${NWS_API}/points/${lat},${lon}`)
    if (!pointsRes.ok) throw new Error('Failed to get forecast points')
    const pointsData = await pointsRes.json()
    
    const forecastUrl = pointsData.properties?.forecast
    if (!forecastUrl) throw new Error('No forecast URL found')
    
    const forecastRes = await fetch(forecastUrl)
    if (!forecastRes.ok) throw new Error('Failed to fetch forecast')
    const forecastData = await forecastRes.json()
    
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
