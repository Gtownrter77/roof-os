import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { fetchWithTimeout } from '../../../lib/api-security'
import { describeAerialImageryAvailability } from '../../../lib/measurements/aerial-provider'
import { buildOnePhotoPacket } from '../../../lib/ai/one-photo'

const NWS = 'https://api.weather.gov'
const UA = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const body = await request.json().catch(() => null) as { latitude?: number; longitude?: number; address?: string } | null
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'Photo has no GPS. Enable location on the phone and retake.' }, { status: 400 })
  }

  const geo = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
    { headers: { accept: 'application/json', 'user-agent': UA } },
    8_000,
  ).catch(() => null)
  const geoJson = geo && geo.ok ? await geo.json().catch(() => null) : null
  const address = body?.address || geoJson?.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
  const zip = geoJson?.address?.postcode || ''
  const state = geoJson?.address?.state || ''

  const nws = await fetchWithTimeout(
    `${NWS}/alerts?point=${latitude},${longitude}&limit=20`,
    { headers: { accept: 'application/geo+json', 'user-agent': UA } },
    8_000,
  ).catch(() => null)
  const nwsJson = nws && nws.ok ? await nws.json().catch(() => null) : null
  const storm = (nwsJson?.features ?? []).find((feature: any) => /hail|thunderstorm|wind|tornado/i.test(`${feature.properties?.event ?? ''} ${feature.properties?.headline ?? ''}`))
  const stormDate = storm?.properties?.onset || storm?.properties?.effective || null
  const stormEvent = storm?.properties?.event || null

  const aerial = describeAerialImageryAvailability(address)
  const codeNotes = [
    state ? `Confirm ${state} roofing code with the local authority.` : 'State not resolved. Confirm locally.',
    'Ice barrier, underlayment, and ventilation must be verified before the packet is trusted.',
  ]

  const packet = buildOnePhotoPacket({
    address,
    latitude,
    longitude,
    stormDate,
    stormEvent,
    aerialNote: aerial.sources[0]?.note || 'Open aerial catalog only. Measure from the inspection photo.',
    code: zip ? `${state || 'Local'} code reference for ${zip}` : 'Local code reference',
    codeNotes,
    squares: null,
  })

  return NextResponse.json({ packet, zip, state })
}
