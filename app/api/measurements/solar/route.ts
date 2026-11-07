import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, isUuid, requireWorkspaceMember } from '../../../../lib/api-security'

export const runtime = 'nodejs'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const SOLAR_API = 'https://solar.googleapis.com/v1/buildingInsights:findClosest'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'

const SQM_TO_SQFT = 10.7639
const FEET_PER_METER = 3.28084

type GeoLoc = { latitude: number; longitude: number; displayName?: string }
type Segment = { pitchDeg: number; azimuthDeg: number; areaSqM: number }
type MeasurementRow = Record<string, unknown>

function pitchStringFromDegrees(tiltDeg: number): string {
  const rise = Math.round(Math.tan((tiltDeg * Math.PI) / 180) * 12 * 10) / 10
  return `${rise}/12`
}

function estimatedPerimeterFt(areaSqM: number, pitchDeg: number): number {
  const slopeFactor = pitchDeg > 0 ? 1 / Math.cos((pitchDeg * Math.PI) / 180) : 1
  const sideFlatM = Math.sqrt(areaSqM / slopeFactor)
  return Math.round(sideFlatM * 4 * FEET_PER_METER)
}

function polygonAreaAndPerimeter(coords: Array<[number, number]>) {
  if (coords.length < 3) return { areaSqM: 0, perimeterM: 0 }
  const lat0 = coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length
  const scaleX = 111320 * Math.cos(lat0 * Math.PI / 180)
  const scaleY = 110540
  const projected = coords.map(([lon, lat]) => [lon * scaleX, lat * scaleY] as [number, number])
  let area = 0
  let perimeter = 0
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i]
    const [x2, y2] = projected[(i + 1) % projected.length]
    area += x1 * y2 - x2 * y1
    perimeter += Math.hypot(x2 - x1, y2 - y1)
  }
  return { areaSqM: Math.abs(area) / 2, perimeterM: perimeter }
}

async function geocodeAddress(address: string): Promise<GeoLoc | null> {
  const url = new URL(NOMINATIM)
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  const res = await fetchWithTimeout(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) return null
  const payload = await res.json()
  const hit = Array.isArray(payload) && payload[0] ? payload[0] : null
  if (!hit) return null
  const latitude = Number(hit.lat)
  const longitude = Number(hit.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude, displayName: typeof hit.display_name === 'string' ? hit.display_name : address }
}

async function runSolar(lat: number, lon: number): Promise<{ source: string; segments: Segment[] } | null> {
  const apiKey = process.env.GOOGLE_SOLAR_API_KEY?.trim()
  if (!apiKey) return null

  const url = new URL(SOLAR_API)
  url.searchParams.set('location.latitude', String(lat))
  url.searchParams.set('location.longitude', String(lon))
  url.searchParams.set('requiredQuality', 'LOW')
  url.searchParams.set('key', apiKey)

  try {
    const res = await fetchWithTimeout(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT }, cache: 'no-store' })
    if (!res.ok) return null

    const solar = await res.json()
    const stats = solar?.solarPotential?.roofSegmentStats
    if (!Array.isArray(stats)) return null

    const segments: Segment[] = []
    for (const seg of stats) {
      const pitchDeg = Number(seg?.pitchDeg ?? 0)
      const azimuthDeg = Number(seg?.azimuthDeg ?? 0)
      const areaSqM = Number(seg?.stats?.areaMeters2 ?? seg?.areaMeters2 ?? 0)
      if (areaSqM > 0) segments.push({ pitchDeg, azimuthDeg, areaSqM })
    }
    return segments.length ? { source: 'google-solar-api', segments } : null
  } catch {
    return null
  }
}

async function runOpenStreetMap(lat: number, lon: number): Promise<{ source: string; segments: Segment[] } | null> {
  const query = `[out:json][timeout:15];(way(around:35,${lat},${lon})[building];);out geom;`
  try {
    const res = await fetchWithTimeout(new URL(OVERPASS), {
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
      body: new URLSearchParams({ data: query }).toString(),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const payload = await res.json()
    const elements = Array.isArray(payload?.elements) ? payload.elements : []

    let best: { areaSqM: number; perimeterM: number } | null = null
    for (const el of elements) {
      if (!Array.isArray(el.geometry)) continue
      const coords = el.geometry
        .flatMap((p): Array<[number, number]> => {
          if (!Array.isArray(p)) return []
          const lng = Number(p[0]); const latI = Number(p[1])
          return Number.isFinite(lng) && Number.isFinite(latI) ? [[lng, latI]] : []
        })
        .filter(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90)
      if (coords.length < 3) continue
      const m = polygonAreaAndPerimeter(coords)
      if (m.areaSqM > 0 && (!best || m.areaSqM > best.areaSqM)) best = m
    }
    if (!best) return null
    return { source: 'openstreetmap-overpass', segments: [{ pitchDeg: 0, azimuthDeg: undefined as any, areaSqM: best.areaSqM }] }
  } catch {
    return null
  }
}

function jsonErr(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonErr('Authentication required.', 401)

  const params = request.nextUrl.searchParams
  const workspaceId = params.get('workspaceId')
  const address = params.get('address')?.trim()
  const inspectionId = params.get('inspectionId')

  if (!isUuid(workspaceId)) return jsonErr('workspaceId must be a valid UUID.', 400)
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId!)
  if (membership.response) return membership.response

  if (!address || address.length > 240) return jsonErr('address is required.', 400)
  if (inspectionId && !isUuid(inspectionId)) return jsonErr('inspectionId must be a valid UUID.', 400)

  const location = await geocodeAddress(address)
  if (!location) return jsonErr('Address could not be located.', 404)

  // 1. Try Google Solar first when configured; it returns real sloped facet area and pitch.
  let source = runSolar(location.latitude, location.longitude)

  // 2. Gracefully fall back to OpenStreetMap building footprints when Solar has no key,
  //    is unreachable, or returns no segments. Flat footprint only; pitch unknown.
  if (!source) source = runOpenStreetMap(location.latitude, location.longitude)
  const fallbackSource = await source
  if (!fallbackSource) {
    return jsonErr(
      'No roof measurement available at this address. Try a more specific address or enter measurements manually.',
      422
    )
  }

  const segments: Segment[] = fallbackSource.segments
  const totalSlopedAreaSqM = segments.reduce((s, seg) => s + seg.areaSqM, 0)
  const totalSlopedAreaSqFt = Math.round(totalSlopedAreaSqM * SQM_TO_SQFT)
  const roofSquares = Math.round((totalSlopedAreaSqFt / 100) * 100) / 100

  const dominant = segments.reduce((a, b) => (a.areaSqM > b.areaSqM ? a : b))
  const predominantPitch = segments.some((seg) => seg.pitchDeg > 0)
    ? pitchStringFromDegrees(dominant.pitchDeg)
    : null
  const estimatedPerimTotal = segments.reduce((s, seg) => s + estimatedPerimeterFt(seg.areaSqM, seg.pitchDeg), 0)

  const facets: Array<{ index: number; pitchString: string | null; azimuthDeg?: number; areaSqFt: number; squares: number }> =
    segments.map((seg, i) => ({
      index: i + 1,
      pitchString: seg.pitchDeg > 0 ? pitchStringFromDegrees(seg.pitchDeg) : null,
      azimuthDeg: seg.azimuthDeg,
      areaSqFt: Math.round(seg.areaSqM * SQM_TO_SQFT),
      squares: Math.round((seg.areaSqM * SQM_TO_SQFT) / 100 * 100) / 100,
    }))

  const insertData: MeasurementRow = {
    workspace_id: workspaceId,
    inspection_id: inspectionId ?? null,
    source_type: fallbackSource.source === 'google-solar-api' ? 'aerial_provider' : 'aerial_provider',
    confidence: 'low',
    roof_area_sqft: totalSlopedAreaSqFt,
    roof_squares: roofSquares,
    pitch: predominantPitch ?? null,
    latitude: Math.round(location.latitude * 1e7) / 1e7,
    longitude: Math.round(location.longitude * 1e7) / 1e7,
    source_reference: `${fallbackSource.source}:${address.slice(0, 160)}`,
    notes: `${segments.length} roof facet(s). Estimated perimeter ~${estimatedPerimTotal} ft. Satellite/satellite-footprint measurements are non-authoritative; verify on-site before use in estimates or claims.`,
    created_by: user.id,
  }

  const { data: saved, error: saveErr } = await supabase
    .from('inspection_measurements')
    .insert(insertData)
    .select('id,source_type,confidence,roof_area_sqft,roof_squares,pitch,captured_at')
    .single()

  const base = {
    address,
    geocode: { latitude: location.latitude, longitude: location.longitude },
    totalSlopedAreaSqFt,
    roofSquares,
    predominantPitch: predominantPitch ?? null,
    estimatedPerimeterFt: estimatedPerimTotal,
    segmentCount: segments.length,
    facets,
    source: fallbackSource.source,
    warning: 'Satellite-derived measurements are non-authoritative estimates; verify on-site before use in estimates or claims.',
  } as const

  if (saveErr) {
    return NextResponse.json({
      measurement: null,
      saveError: 'Measurement data was retrieved but could not be saved to the database.',
      ...base,
    })
  }

  return NextResponse.json({ measurement: saved, ...base })
}
