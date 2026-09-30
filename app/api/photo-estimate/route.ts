import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { fetchWithTimeout, isUuid, readJson, requireWorkspaceMember } from '../../../lib/api-security'

const USER_AGENT = 'ROOF-OS/1.0 (https://github.com/Gtownrter77/roof-os)'
const WEATHER_EVENTS = /hail|tornado|thunderstorm|wind|hurricane|tropical|flood|ice|winter storm|derecho/i
const MAX_PHOTOS = 50

type GeocodeResult = { lat?: string; lon?: string; display_name?: string }
type FootprintElement = { geometry?: Array<{ lon?: number; lat?: number }> }
type WeatherFeature = { id?: string; properties?: { event?: string; headline?: string; onset?: string; effective?: string; expires?: string; severity?: string } }

async function getUserAndWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
  if (error) return { supabase, user, workspaceId: null }
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
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { address?: string; leadId?: string; inspectionId?: string; photoIds?: string[]; roofSquares?: number; gutterLf?: number }
  const address = body.address?.trim() ?? ''
  if (!address || address.length > 512) return NextResponse.json({ error: 'A property address of 1–512 characters is required.' }, { status: 400 })
  for (const [field, value] of [['leadId', body.leadId], ['inspectionId', body.inspectionId]] as const) {
    if (value !== undefined && !isUuid(value)) return NextResponse.json({ error: `${field} must be a valid UUID.` }, { status: 400 })
  }
  const photoIds = body.photoIds ?? []
  if (!Array.isArray(photoIds) || photoIds.length > MAX_PHOTOS || photoIds.some((id) => !isUuid(id)) || new Set(photoIds).size !== photoIds.length) {
    return NextResponse.json({ error: `photoIds must contain at most ${MAX_PHOTOS} unique photo UUIDs.` }, { status: 400 })
  }
  const roofSquares = Number(body.roofSquares ?? 0)
  const gutterLf = Number(body.gutterLf ?? 0)
  if (!Number.isFinite(roofSquares) || roofSquares < 0 || roofSquares > 100_000 || !Number.isFinite(gutterLf) || gutterLf < 0 || gutterLf > 1_000_000) {
    return NextResponse.json({ error: 'Enter realistic non-negative roof squares (up to 100,000) and gutter length (up to 1,000,000 LF).' }, { status: 400 })
  }

  if (body.leadId) {
    const { data, error } = await supabase.from('leads').select('id').eq('id', body.leadId).eq('workspace_id', workspaceId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate lead access.' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'The lead does not belong to this workspace.' }, { status: 400 })
  }
  if (body.inspectionId) {
    let query = supabase.from('inspection_sessions').select('id,lead_id').eq('id', body.inspectionId).eq('workspace_id', workspaceId)
    if (body.leadId) query = query.eq('lead_id', body.leadId)
    const { data, error } = await query.maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate inspection access.' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'The inspection does not belong to this workspace and lead.' }, { status: 400 })
  }
  if (photoIds.length) {
    let query = supabase.from('inspection_photos').select('id').in('id', photoIds).eq('workspace_id', workspaceId)
    if (body.inspectionId) query = query.eq('inspection_id', body.inspectionId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Could not validate photo access.' }, { status: 503 })
    if ((data ?? []).length !== photoIds.length) return NextResponse.json({ error: 'Every photo must belong to this workspace and selected inspection.' }, { status: 400 })
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
  if (!Array.isArray(geocoded) || !geocoded[0]) return NextResponse.json({ error: 'Address could not be located. Confirm the address and try again.' }, { status: 404 })
  const latitude = Number(geocoded[0].lat); const longitude = Number(geocoded[0].lon)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Address lookup returned invalid coordinates.' }, { status: 502 })
  }

  const overpass = `[out:json][timeout:10];way(around:35,${latitude},${longitude})[building];out geom;`
  const footprintResponse = await fetchWithTimeout('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ data: overpass }).toString(), cache: 'no-store' }, 12_000).catch(() => null)
  const footprintPayload = footprintResponse?.ok ? await footprintResponse.json().catch(() => null) as { elements?: FootprintElement[] } | null : null
  const elements = Array.isArray(footprintPayload?.elements) ? footprintPayload.elements.slice(0, 100) : []
  const footprintSqFt = Math.max(0, ...elements.map((element) => footprintAreaSqFt((element.geometry ?? []).slice(0, 250).map((point) => [Number(point.lon), Number(point.lat)] as [number, number]))))

  const nwsUrl = `https://api.weather.gov/alerts?point=${latitude},${longitude}&limit=50`
  const nwsResponse = await fetchWithTimeout(nwsUrl, { headers: { accept: 'application/geo+json', 'user-agent': USER_AGENT }, cache: 'no-store' }, 8_000).catch(() => null)
  const nwsPayload = nwsResponse?.ok ? await nwsResponse.json().catch(() => null) as { features?: WeatherFeature[] } | null : null
  const storms = (Array.isArray(nwsPayload?.features) ? nwsPayload.features : []).slice(0, 50).filter((feature) => WEATHER_EVENTS.test(`${feature.properties?.event ?? ''} ${feature.properties?.headline ?? ''}`)).slice(0, 20).map((feature) => ({ event: feature.properties?.event ?? 'Weather event', onset: feature.properties?.onset ?? feature.properties?.effective ?? null, expires: feature.properties?.expires ?? null, severity: feature.properties?.severity ?? null, headline: feature.properties?.headline ?? null, sourceUrl: feature.id ?? nwsUrl, confidence: 'candidate' }))

  const { data: priceBook } = await supabase.from('price_books').select('id,name,local_tax_rate,tax_source').eq('workspace_id', workspaceId).eq('source', 'owner-managed').eq('status', 'active').order('effective_at', { ascending: false }).limit(1).maybeSingle()
  const roofArea = roofSquares > 0 ? roofSquares * 100 : footprintSqFt
  const estimate = { status: 'needs_price_review', source: 'owner-entered quantities plus owner-managed price book', roofSquares: roofArea / 100, gutterLf, lineItems: [{ item: 'Roofing work', quantity: roofArea / 100, unit: 'square', unitPrice: null }, { item: 'Gutters', quantity: gutterLf, unit: 'linear foot', unitPrice: null }], priceBookId: priceBook?.id ?? null, taxRate: priceBook ? Number(priceBook.local_tax_rate ?? 0) : null }
  const report = { title: `ROOF/OS Photo-to-Estimate Review — ${address}`, status: 'needs_review', address, geocode: { latitude, longitude, displayName: geocoded[0].display_name }, photoIds, propertyEvidence: { footprintSqFt, source: 'OpenStreetMap building footprint assist', confidence: footprintSqFt > 0 ? 'low' : 'none' }, stormEvidence: storms, estimate, requiredReview: ['Confirm the photographed property matches this address', 'Review photo evidence and aerial/property footprint', 'Verify roof pitch, waste, slopes, valleys, hips, eaves, rakes, and gutters', 'Review NOAA candidates as corroborating evidence only', 'Confirm the active owner price book', 'Technician approval required before customer delivery'] }
  const { data: workflow, error } = await supabase.from('photo_estimate_workflows').insert({ workspace_id: workspaceId, lead_id: body.leadId ?? null, inspection_id: body.inspectionId ?? null, created_by: user.id, status: 'report_review', address, address_confidence: 100, latitude, longitude, footprint_sqft: footprintSqFt || null, roof_squares: estimate.roofSquares || null, gutter_lf: gutterLf || null, storm_candidates: storms, estimate, report, source_photo_ids: photoIds }).select('id,status,address,report,estimate,storm_candidates,created_at').single()
  if (error) return NextResponse.json({ error: 'Could not save the review workflow.' }, { status: 502 })
  return NextResponse.json({ workflow, warning: 'This is a review packet. It is not a certified roof measurement, proven date of loss, or customer-ready estimate.' }, { status: 201 })
}
