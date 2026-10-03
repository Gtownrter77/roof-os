import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, isUuid, readJson } from '../../../../lib/api-security'

const USER_AGENT = 'ROOF-OS/1.0 (https://github.com/Gtownrter77/roof-os)'
const FEET_PER_METER = 3.28084

type GeocodeResult = { lat?: string; lon?: string; display_name?: string }
type FootprintElement = { geometry?: Array<{ lon?: number; lat?: number }> }
type WeatherFeature = { properties?: { event?: string; headline?: string } }

function areaSqFt(coords: Array<[number, number]>) {
  if (coords.length < 3) return 0
  const lat0 = coords.reduce((sum, point) => sum + point[1], 0) / coords.length
  const sx = 111320 * Math.cos(lat0 * Math.PI / 180); const sy = 110540
  const points = coords.map(([lon, lat]) => [lon * sx, lat * sy] as [number, number])
  let area = 0
  for (let i = 0; i < points.length; i += 1) { const [x1, y1] = points[i]; const [x2, y2] = points[(i + 1) % points.length]; area += x1 * y2 - x2 * y1 }
  return Math.round(Math.abs(area / 2) * FEET_PER_METER * FEET_PER_METER)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { address?: string; roofSquares?: number; gutterLf?: number; photoCount?: number; inspectionId?: string }
  if (!isUuid(body.inspectionId)) return NextResponse.json({ error: 'A saved inspection is required.' }, { status: 400 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is available.' }, { status: 403 })
  const { data: inspection, error: inspectionError } = await supabase.from('inspection_sessions').select('id,lead_id').eq('id', body.inspectionId).eq('workspace_id', workspaceId).maybeSingle()
  if (inspectionError) return NextResponse.json({ error: 'Could not load the inspection.' }, { status: 503 })
  if (!inspection) return NextResponse.json({ error: 'That inspection is not in this workspace.' }, { status: 404 })
  const address = body.address?.trim() ?? ''
  const roofSquares = Number(body.roofSquares); const gutterLf = Number(body.gutterLf); const photoCount = Number(body.photoCount ?? 0)
  if (!address || address.length > 512) return NextResponse.json({ error: 'Property address must contain 1–512 characters.' }, { status: 400 })
  if (!Number.isFinite(roofSquares) || roofSquares <= 0 || roofSquares > 100_000 || !Number.isFinite(gutterLf) || gutterLf < 0 || gutterLf > 1_000_000 || !Number.isInteger(photoCount) || photoCount < 0 || photoCount > 10_000) {
    return NextResponse.json({ error: 'Enter realistic roof squares, gutter length, and photo count.' }, { status: 400 })
  }

  const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search')
  geocodeUrl.searchParams.set('q', address); geocodeUrl.searchParams.set('format', 'jsonv2'); geocodeUrl.searchParams.set('limit', '1')
  let geocodeResponse: Response
  try {
    geocodeResponse = await fetchWithTimeout(geocodeUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' }, 8_000)
  } catch {
    return NextResponse.json({ error: 'Address lookup is temporarily unavailable.' }, { status: 503 })
  }
  if (!geocodeResponse.ok) return NextResponse.json({ error: 'Address lookup failed.' }, { status: 502 })
  const geocoded = await geocodeResponse.json().catch(() => null) as GeocodeResult[] | null
  if (!Array.isArray(geocoded) || !geocoded[0]) return NextResponse.json({ error: 'Address could not be located.' }, { status: 404 })
  const latitude = Number(geocoded[0].lat); const longitude = Number(geocoded[0].lon)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return NextResponse.json({ error: 'Address lookup returned invalid coordinates.' }, { status: 502 })

  const overpass = `[out:json][timeout:10];way(around:35,${latitude},${longitude})[building];out geom;`
  const footprintResponse = await fetchWithTimeout('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ data: overpass }).toString(), cache: 'no-store' }, 12_000).catch(() => null)
  const footprintPayload = footprintResponse?.ok ? await footprintResponse.json().catch(() => null) as { elements?: FootprintElement[] } | null : null
  const elements = Array.isArray(footprintPayload?.elements) ? footprintPayload.elements.slice(0, 100) : []
  const footprintSqFt = Math.max(0, ...elements.map((element) => areaSqFt((element.geometry ?? []).slice(0, 250).map((point) => [Number(point.lon), Number(point.lat)] as [number, number]))))

  const nwsUrl = `https://api.weather.gov/alerts?point=${latitude},${longitude}&limit=50`
  const nwsResponse = await fetchWithTimeout(nwsUrl, { headers: { accept: 'application/geo+json', 'user-agent': USER_AGENT }, cache: 'no-store' }, 8_000).catch(() => null)
  const nwsPayload = nwsResponse?.ok ? await nwsResponse.json().catch(() => null) as { features?: WeatherFeature[] } | null : null
  const stormCandidateCount = (Array.isArray(nwsPayload?.features) ? nwsPayload.features : []).slice(0, 50).filter((feature) => /hail|tornado|thunderstorm|wind|hurricane|tropical|flood|ice|winter storm|derecho/i.test(`${feature.properties?.event ?? ''} ${feature.properties?.headline ?? ''}`)).length

  const { data: activePriceBook } = workspaceId
    ? await supabase.from('price_books').select('id,name,effective_at,local_tax_rate,tax_source').eq('workspace_id', workspaceId).eq('source', 'owner-managed').eq('status', 'active').order('effective_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }
  const pricing = activePriceBook
    ? { status: 'active', priceBookId: activePriceBook.id, name: activePriceBook.name, effectiveAt: activePriceBook.effective_at, localTaxRate: Number(activePriceBook.local_tax_rate), taxSource: activePriceBook.tax_source ?? 'owner-entered local rate' }
    : { status: 'unavailable', localTaxRate: null, taxSource: null }

  return NextResponse.json({ report: { title: `ROOF/OS inspection packet — ${address}`, inspectionId: inspection.id, status: 'needs_review', generatedAt: new Date().toISOString(), address, geocode: { latitude, longitude, displayName: geocoded[0].display_name }, evidence: { photoCount, footprintSqFt, stormCandidateCount, measurementSource: 'manual quantities supplied by user; unverified' }, quantities: { roofSquares, gutterLf }, pricing, sources: { footprint: '© OpenStreetMap contributors', storms: nwsUrl, parcelVerification: 'https://www.arcgis.com/home/search.html?q=parcel%20viewer' }, requiredReview: ['Confirm property and parcel', 'Review photos and footprint against aerial/drone evidence', 'Verify roof/gutter quantities', 'Review NOAA candidates as corroborating evidence only', 'Attach or confirm an approved price book', 'Human approval before external use'] } })
}
