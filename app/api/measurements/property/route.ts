import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, isUuid, requireWorkspaceMember } from '../../../../lib/api-security'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const OAM_META = 'https://oam-catalog.herokuapp.com/meta'
const USER_AGENT = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'
const FEET_PER_METER = 3.28084
const MAX_BUILDING_CANDIDATES = 25

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function polygonAreaAndPerimeter(coords: Array<[number, number]>) {
  if (coords.length < 3) return { areaSqM: 0, perimeterM: 0 }
  const lat0 = coords.reduce((sum, point) => sum + point[1], 0) / coords.length
  const scaleX = 111320 * Math.cos(lat0 * Math.PI / 180)
  const scaleY = 110540
  const projected = coords.map(([lon, lat]) => [lon * scaleX, lat * scaleY] as [number, number])
  let area = 0; let perimeter = 0
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i]; const [x2, y2] = projected[(i + 1) % projected.length]
    area += x1 * y2 - x2 * y1
    perimeter += Math.hypot(x2 - x1, y2 - y1)
  }
  return { areaSqM: Math.abs(area) / 2, perimeterM: perimeter }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const workspaceId = params.get('workspaceId')
  const address = params.get('address')?.trim()
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  if (!address || address.length > 240) return NextResponse.json({ error: 'address is required.' }, { status: 400 })

  const geocodeUrl = new URL(NOMINATIM)
  geocodeUrl.searchParams.set('q', address)
  geocodeUrl.searchParams.set('format', 'jsonv2')
  geocodeUrl.searchParams.set('limit', '1')
  const geocodeResponse = await fetchWithTimeout(geocodeUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' })
  if (!geocodeResponse.ok) return NextResponse.json({ error: 'Address lookup failed.' }, { status: 502 })
  const geocoded = await geocodeResponse.json()
  const geocodeResult = Array.isArray(geocoded) && record(geocoded[0]) ? geocoded[0] : null
  if (!geocodeResult) return NextResponse.json({ error: 'Address could not be located.' }, { status: 404 })
  const latitude = Number(geocodeResult.lat)
  const longitude = Number(geocodeResult.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Address lookup returned invalid coordinates.' }, { status: 502 })
  }

  const oamUrl = new URL(OAM_META)
  oamUrl.searchParams.set('bbox', `${longitude - 0.002},${latitude - 0.002},${longitude + 0.002},${latitude + 0.002}`)
  oamUrl.searchParams.set('has_tiled', 'true')
  oamUrl.searchParams.set('limit', '10')
  let openAerialMap: unknown[] = []
  try {
    const oamResponse = await fetchWithTimeout(oamUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' })
    if (oamResponse.ok) {
      const oamPayload: unknown = await oamResponse.json()
      if (Array.isArray(oamPayload)) {
        openAerialMap = oamPayload
      } else if (record(oamPayload)) {
        const results = Array.isArray(oamPayload.results) ? oamPayload.results : Array.isArray(oamPayload.data) ? oamPayload.data : []
        openAerialMap = results
      }
    }
  } catch { openAerialMap = [] }

  const query = `[out:json][timeout:15];(way(around:35,${latitude},${longitude})[building];);out geom;`
  const overpassResponse = await fetchWithTimeout(OVERPASS, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ data: query }).toString(), cache: 'no-store' })
  if (!overpassResponse.ok) return NextResponse.json({ error: 'OpenStreetMap footprint lookup failed.' }, { status: 502 })
  const overpass: unknown = await overpassResponse.json()
  const elements = record(overpass) && Array.isArray(overpass.elements) ? overpass.elements : []
  const candidates = elements.map((element): { osmId: unknown; buildingType: string; footprintSqFt: number; perimeterFt: number; source: string; confidence: string } | null => {
    if (!record(element)) return null
    const geometry = Array.isArray(element.geometry) ? element.geometry : []
    const coords = geometry.flatMap((point): Array<[number, number]> => {
      if (!record(point)) return []
      const lon = Number(point.lon); const lat = Number(point.lat)
      return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90 ? [[lon, lat]] : []
    })
    const measurements = polygonAreaAndPerimeter(coords)
    const buildingType = typeof element.tags === 'object' && element.tags !== null && !Array.isArray(element.tags) && typeof (element.tags as Record<string, unknown>).building === 'string'
      ? (element.tags as Record<string, unknown>).building as string
      : 'yes'
    return { osmId: element.id ?? null, buildingType, footprintSqFt: Math.round(measurements.areaSqM * FEET_PER_METER * FEET_PER_METER), perimeterFt: Math.round(measurements.perimeterM * FEET_PER_METER), source: 'OpenStreetMap', confidence: 'low' }
  }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null && candidate.footprintSqFt > 0).sort((a, b) => b.footprintSqFt - a.footprintSqFt).slice(0, MAX_BUILDING_CANDIDATES)

  return NextResponse.json({ address, geocode: { latitude, longitude, displayName: typeof geocodeResult.display_name === 'string' ? geocodeResult.display_name : address }, candidates, imagerySources: { openAerialMap: { results: openAerialMap, catalogUrl: oamUrl.toString(), confidence: 'source-dependent', attribution: 'OpenAerialMap imagery is openly licensed per its item metadata; preserve each item’s provider and license.' }, arcgisEarth: { reviewUrl: 'https://www.esri.com/en-us/arcgis/products/arcgis-earth/overview', confidence: 'manual-review', note: 'ArcGIS Earth/ArcGIS imagery requires an authorized Esri account or licensed layer and must retain Esri/provider attribution.' } }, interpretation: 'Building footprint is not roof surface area. Roof pitch, overhangs, dormers, valleys, hips, waste, and gutters require aerial/roof measurement or human verification.', verificationLinks: { officialParcelViewerSearch: 'https://www.arcgis.com/home/search.html?q=parcel%20viewer', cobbExampleParcelViewer: 'https://geo-cobbcountyga.hub.arcgis.com/app/e22d8c597b4e4762bcd2caa6127696e4' }, attribution: '© OpenStreetMap contributors' })
}
