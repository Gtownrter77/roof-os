import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const USER_AGENT = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'
const FEET_PER_METER = 3.28084

function areaSqFt(coords: Array<[number, number]>) {
  if (coords.length < 3) return 0
  const lat0 = coords.reduce((sum, point) => sum + point[1], 0) / coords.length
  const sx = 111320 * Math.cos(lat0 * Math.PI / 180); const sy = 110540
  const p = coords.map(([lon, lat]) => [lon * sx, lat * sy] as [number, number])
  let area = 0
  for (let i = 0; i < p.length; i += 1) { const [x1, y1] = p[i]; const [x2, y2] = p[(i + 1) % p.length]; area += x1 * y2 - x2 * y1 }
  return Math.round(Math.abs(area / 2) * FEET_PER_METER * FEET_PER_METER)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: { address?: string; roofSquares?: number; gutterLf?: number; photoCount?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const address = body.address?.trim() ?? ''
  const roofSquares = Number(body.roofSquares); const gutterLf = Number(body.gutterLf); const photoCount = Number(body.photoCount ?? 0)
  if (!address) return NextResponse.json({ error: 'Property address is required.' }, { status: 400 })
  if (!Number.isFinite(roofSquares) || roofSquares <= 0 || !Number.isFinite(gutterLf) || gutterLf < 0 || !Number.isInteger(photoCount) || photoCount < 0) return NextResponse.json({ error: 'Enter valid roof squares, gutter LF, and photo count.' }, { status: 400 })

  const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search'); geocodeUrl.searchParams.set('q', address); geocodeUrl.searchParams.set('format', 'jsonv2'); geocodeUrl.searchParams.set('limit', '1')
  const geocodeResponse = await fetch(geocodeUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' })
  if (!geocodeResponse.ok) return NextResponse.json({ error: 'Address lookup failed.' }, { status: 502 })
  const geocoded = await geocodeResponse.json(); if (!geocoded[0]) return NextResponse.json({ error: 'Address could not be located.' }, { status: 404 })
  const latitude = Number(geocoded[0].lat); const longitude = Number(geocoded[0].lon)

  const overpass = `[out:json][timeout:15];way(around:35,${latitude},${longitude})[building];out geom;`
  const footprintResponse = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ data: overpass }).toString(), cache: 'no-store' })
  const footprintPayload = footprintResponse.ok ? await footprintResponse.json() : { elements: [] }
  const footprintSqFt = Math.max(0, ...(footprintPayload.elements ?? []).map((element: any) => areaSqFt((element.geometry ?? []).map((point: any) => [Number(point.lon), Number(point.lat)] as [number, number]))))

  const nwsUrl = `https://api.weather.gov/alerts?point=${latitude},${longitude}&limit=50`
  const nwsResponse = await fetch(nwsUrl, { headers: { accept: 'application/geo+json', 'user-agent': USER_AGENT }, cache: 'no-store' })
  const nwsPayload = nwsResponse.ok ? await nwsResponse.json() : { features: [] }
  const stormCandidateCount = (nwsPayload.features ?? []).filter((feature: any) => /hail|tornado|thunderstorm|wind|hurricane|tropical|flood|ice|winter storm|derecho/i.test(`${feature.properties?.event ?? ''} ${feature.properties?.headline ?? ''}`)).length
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  const { data: activePriceBook } = workspaceId
    ? await supabase.from('price_books').select('id,name,effective_at,local_tax_rate,tax_source').eq('workspace_id', workspaceId).eq('source', 'owner-managed').eq('status', 'active').order('effective_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }
  const pricing = activePriceBook
    ? { status: 'active', priceBookId: activePriceBook.id, name: activePriceBook.name, effectiveAt: activePriceBook.effective_at, localTaxRate: Number(activePriceBook.local_tax_rate), taxSource: activePriceBook.tax_source ?? 'owner-entered local rate' }
    : { status: 'unavailable', localTaxRate: null, taxSource: null }

  return NextResponse.json({ report: { title: `ROOF/OS Inspection Report — ${address}`, status: 'needs_review', generatedAt: new Date().toISOString(), address, geocode: { latitude, longitude, displayName: geocoded[0].display_name }, evidence: { photoCount, footprintSqFt, stormCandidateCount, measurementSource: 'manual quantities supplied by user; unverified' }, quantities: { roofSquares, gutterLf }, pricing, sources: { footprint: '© OpenStreetMap contributors', storms: nwsUrl, parcelVerification: 'https://www.arcgis.com/home/search.html?q=parcel%20viewer' }, requiredReview: ['Confirm property and parcel', 'Review photos and footprint against aerial/drone evidence', 'Verify roof/gutter quantities', 'Review NOAA candidates as corroborating evidence only', 'Attach or confirm an approved price book', 'Human approval before external use'] } })
}
