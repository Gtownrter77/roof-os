import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'
const FEET_PER_METER = 3.28084

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
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  if (!address || address.length > 240) return NextResponse.json({ error: 'address is required.' }, { status: 400 })

  const geocodeUrl = new URL(NOMINATIM)
  geocodeUrl.searchParams.set('q', address)
  geocodeUrl.searchParams.set('format', 'jsonv2')
  geocodeUrl.searchParams.set('limit', '1')
  const geocodeResponse = await fetch(geocodeUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' })
  if (!geocodeResponse.ok) return NextResponse.json({ error: 'Address lookup failed.' }, { status: 502 })
  const geocoded = await geocodeResponse.json()
  if (!geocoded[0]) return NextResponse.json({ error: 'Address could not be located.' }, { status: 404 })
  const latitude = Number(geocoded[0].lat); const longitude = Number(geocoded[0].lon)

  const query = `[out:json][timeout:15];(way(around:35,${latitude},${longitude})[building];);out geom;`
  const overpassResponse = await fetch(OVERPASS, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ data: query }).toString(), cache: 'no-store' })
  if (!overpassResponse.ok) return NextResponse.json({ error: 'OpenStreetMap footprint lookup failed.' }, { status: 502 })
  const overpass = await overpassResponse.json()
  const candidates = (overpass.elements ?? []).map((element: any) => {
    const coords = (element.geometry ?? []).map((point: any) => [Number(point.lon), Number(point.lat)] as [number, number])
    const measurements = polygonAreaAndPerimeter(coords)
    return { osmId: element.id, buildingType: element.tags?.building ?? 'yes', footprintSqFt: Math.round(measurements.areaSqM * FEET_PER_METER * FEET_PER_METER), perimeterFt: Math.round(measurements.perimeterM * FEET_PER_METER), source: 'OpenStreetMap', confidence: 'low' }
  }).filter((candidate: any) => candidate.footprintSqFt > 0).sort((a: any, b: any) => b.footprintSqFt - a.footprintSqFt)

  return NextResponse.json({ address, geocode: { latitude, longitude, displayName: geocoded[0].display_name }, candidates, interpretation: 'Building footprint is not roof surface area. Roof pitch, overhangs, dormers, valleys, hips, waste, and gutters require aerial/roof measurement or human verification.', verificationLinks: { cobbParcelViewer: 'https://geo-cobbcountyga.hub.arcgis.com/app/e22d8c597b4e4762bcd2caa6127696e4', cobbGisData: 'https://geo-cobbcountyga.hub.arcgis.com/pages/get-data' }, attribution: '© OpenStreetMap contributors' })
}
