import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')
  const lon = request.nextUrl.searchParams.get('lon')
  if (!lat || !lon) return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
  const res = await fetch(url, {
    headers: { 'user-agent': 'ROOF-OS/1.0 (property file; human confirms address)', accept: 'application/json' },
  })
  if (!res.ok) return NextResponse.json({ error: 'Geocoder did not answer.' }, { status: 502 })
  const body = await res.json()
  return NextResponse.json({
    display: body.display_name ?? '',
    house: body.address?.house_number ?? '',
    road: body.address?.road ?? '',
    city: body.address?.city || body.address?.town || body.address?.village || '',
    state: body.address?.state ?? '',
    postcode: body.address?.postcode ?? '',
    source: 'OpenStreetMap Nominatim',
    note: 'Draft address. Human must lock it.',
  })
}
