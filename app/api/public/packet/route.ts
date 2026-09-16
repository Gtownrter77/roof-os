import { NextRequest, NextResponse } from 'next/server'
import { shoelaceSqft } from '../../../../lib/geo'

export async function POST(request: NextRequest) {
  let body: { address?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const address = body.address?.trim() ?? ''
  if (address.length < 8) return NextResponse.json({ error: 'Address required.' }, { status: 400 })

  const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`, {
    headers: { 'user-agent': 'ROOF-OS/1.0 (packet; human verified address)' },
  })
  if (!geoRes.ok) return NextResponse.json({ error: 'Geocoder down.' }, { status: 502 })
  const geo = await geoRes.json()
  if (!geo[0]) return NextResponse.json({ error: 'Address not found.' }, { status: 404 })
  const lat = Number(geo[0].lat)
  const lon = Number(geo[0].lon)

  const nwsPoint = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: { accept: 'application/geo+json', 'user-agent': 'ROOF-OS/1.0' } })
  const point = nwsPoint.ok ? await nwsPoint.json() : null
  const county = point?.properties?.county as string | undefined
  const zone = county?.split('/').pop()
  let alerts: string[] = []
  if (zone) {
    const alertRes = await fetch(`https://api.weather.gov/alerts/active?zone=${zone}`, { headers: { accept: 'application/geo+json', 'user-agent': 'ROOF-OS/1.0' } })
    if (alertRes.ok) {
      const alertBody = await alertRes.json()
      alerts = (alertBody.features ?? []).map((f: any) => f.properties?.headline || f.properties?.event).filter(Boolean)
    }
  }

  let footprintSqft = 0
  let osmNote = 'No building polygon returned.'
  try {
    const q = `[out:json][timeout:20];way(around:35,${lat},${lon})["building"];out geom;`
    const osmRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'ROOF-OS/1.0' },
      body: `data=${encodeURIComponent(q)}`,
    })
    if (osmRes.ok) {
      const osm = await osmRes.json()
      const way = osm.elements?.[0]
      if (way?.geometry) {
        const ring: [number, number][] = way.geometry.map((n: { lat: number; lon: number }) => [n.lon, n.lat])
        if (ring[0] && ring[ring.length - 1] && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
          ring.push(ring[0])
        }
        footprintSqft = Math.round(shoelaceSqft(ring))
        osmNote = way.tags?.building ? `OSM building=${way.tags.building}` : 'OSM building way'
      }
    } else {
      osmNote = `Overpass HTTP ${osmRes.status}`
    }
  } catch {
    osmNote = 'Overpass did not answer.'
  }

  const squares = footprintSqft > 200 ? Math.round((footprintSqft / 100) * 10) / 10 : 0

  return NextResponse.json({
    address: geo[0].display_name,
    lat,
    lon,
    nws: { office: point?.properties?.cwa ?? null, zone, alerts, note: 'Candidates only. Not proof this roof was hit.' },
    measure: {
      footprint_sqft: footprintSqft,
      squares_from_footprint: squares,
      pitch_unknown: true,
      note: squares ? 'Plan-view footprint only. Pitch, hips, and low-slope entries not included. Not certified.' : osmNote,
    },
    estimates: squares ? {
      good: 'Repair draft needs photos of failures. No dollar without a scope.',
      better: `Full reroof draft uses ${squares} plan-view squares × your book after you enter a rate.`,
      best: 'Same squares + upgraded system after you pick it.',
      restoration: 'Same squares. Storm language only if you attach candidate dates and photos.',
    } : null,
    disclaimer: 'Human sends. Human signs. No homeowner email from this route.',
  })
}
