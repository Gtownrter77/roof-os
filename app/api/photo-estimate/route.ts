import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

const USER_AGENT = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'
const WEATHER_EVENTS = /hail|tornado|thunderstorm|wind|hurricane|tropical|flood|ice|winter storm|derecho/i

async function getUserAndWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId }
}

function footprintAreaSqFt(coords: Array<[number, number]>) {
  if (coords.length < 3) return 0
  const lat0 = coords.reduce((sum, point) => sum + point[1], 0) / coords.length
  const sx = 111320 * Math.cos(lat0 * Math.PI / 180); const sy = 110540
  const points = coords.map(([lon, lat]) => [lon * sx, lat * sy] as [number, number])
  let area = 0
  for (let i = 0; i < points.length; i += 1) { const [x1, y1] = points[i]; const [x2, y2] = points[(i + 1) % points.length]; area += x1 * y2 - x2 * y1 }
  return Math.round(Math.abs(area / 2) * 3.28084 * 3.28084)
}

export async function POST(request: NextRequest) {
  const { supabase, user, workspaceId } = await getUserAndWorkspace()
  if (!user || !workspaceId) return NextResponse.json({ error: 'Authentication and workspace are required.' }, { status: 401 })
  let body: { address?: string; leadId?: string; inspectionId?: string; photoIds?: string[]; roofSquares?: number; gutterLf?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const address = body.address?.trim() ?? ''
  if (!address) return NextResponse.json({ error: 'A technician-confirmed property address is required before evidence lookup.' }, { status: 400 })
  const roofSquares = Number(body.roofSquares ?? 0)
  const gutterLf = Number(body.gutterLf ?? 0)
  if (!Number.isFinite(roofSquares) || roofSquares < 0 || !Number.isFinite(gutterLf) || gutterLf < 0) return NextResponse.json({ error: 'Measurements must be non-negative numbers.' }, { status: 400 })

  const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search')
  geocodeUrl.searchParams.set('q', address); geocodeUrl.searchParams.set('format', 'jsonv2'); geocodeUrl.searchParams.set('limit', '1')
  const geocodeResponse = await fetch(geocodeUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' })
  if (!geocodeResponse.ok) return NextResponse.json({ error: 'Address lookup failed.' }, { status: 502 })
  const geocoded = await geocodeResponse.json()
  if (!geocoded[0]) return NextResponse.json({ error: 'Address could not be located. Confirm the address and try again.' }, { status: 404 })
  const latitude = Number(geocoded[0].lat); const longitude = Number(geocoded[0].lon)

  const overpass = `[out:json][timeout:15];way(around:35,${latitude},${longitude})[building];out geom;`
  const footprintResponse = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ data: overpass }).toString(), cache: 'no-store' })
  const footprintPayload = footprintResponse.ok ? await footprintResponse.json() : { elements: [] }
  const footprintSqFt = Math.max(0, ...(footprintPayload.elements ?? []).map((element: any) => footprintAreaSqFt((element.geometry ?? []).map((point: any) => [Number(point.lon), Number(point.lat)] as [number, number]))))

  const nwsUrl = `https://api.weather.gov/alerts?point=${latitude},${longitude}&limit=50`
  const nwsResponse = await fetch(nwsUrl, { headers: { accept: 'application/geo+json', 'user-agent': USER_AGENT }, cache: 'no-store' })
  const nwsPayload = nwsResponse.ok ? await nwsResponse.json() : { features: [] }
  const storms = (nwsPayload.features ?? []).filter((feature: any) => WEATHER_EVENTS.test(`${feature.properties?.event ?? ''} ${feature.properties?.headline ?? ''}`)).slice(0, 20).map((feature: any) => ({ event: feature.properties?.event ?? 'Weather event', onset: feature.properties?.onset ?? feature.properties?.effective ?? null, expires: feature.properties?.expires ?? null, severity: feature.properties?.severity ?? null, headline: feature.properties?.headline ?? null, sourceUrl: feature.id ?? nwsUrl, confidence: 'candidate' }))

  const { data: priceBook } = await supabase.from('price_books').select('id,name,local_tax_rate,tax_source').eq('workspace_id', workspaceId).eq('source', 'owner-managed').eq('status', 'active').order('effective_at', { ascending: false }).limit(1).maybeSingle()
  const roofArea = roofSquares > 0 ? roofSquares * 100 : footprintSqFt
  const estimate = { status: 'needs_price_review', source: 'owner-entered quantities plus owner-managed price book', roofSquares: roofArea / 100, gutterLf, lineItems: [{ item: 'Roofing work', quantity: roofArea / 100, unit: 'square', unitPrice: null }, { item: 'Gutters', quantity: gutterLf, unit: 'linear foot', unitPrice: null }], priceBookId: priceBook?.id ?? null, taxRate: priceBook ? Number(priceBook.local_tax_rate ?? 0) : null }
  const report = { title: `ROOF/OS Photo-to-Estimate Review — ${address}`, status: 'needs_review', address, geocode: { latitude, longitude, displayName: geocoded[0].display_name }, photoIds: body.photoIds ?? [], propertyEvidence: { footprintSqFt, source: 'OpenStreetMap building footprint assist', confidence: footprintSqFt > 0 ? 'low' : 'none' }, stormEvidence: storms, estimate, requiredReview: ['Confirm the photographed property matches this address', 'Review photo evidence and aerial/property footprint', 'Verify roof pitch, waste, slopes, valleys, hips, eaves, rakes, and gutters', 'Review NOAA candidates as corroborating evidence only', 'Confirm the active owner price book', 'Technician approval required before customer delivery'] }
  const { data: workflow, error } = await supabase.from('photo_estimate_workflows').insert({ workspace_id: workspaceId, lead_id: body.leadId ?? null, inspection_id: body.inspectionId ?? null, created_by: user.id, status: 'report_review', address, address_confidence: 100, latitude, longitude, footprint_sqft: footprintSqFt || null, roof_squares: estimate.roofSquares || null, gutter_lf: gutterLf || null, storm_candidates: storms, estimate, report, source_photo_ids: body.photoIds ?? [] }).select('id,status,address,report,estimate,storm_candidates,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not save the review workflow.', detail: error.message }, { status: 502 })
  return NextResponse.json({ workflow, warning: 'This is a review packet. It is not a certified roof measurement, proven date of loss, or customer-ready estimate.' }, { status: 201 })
}
