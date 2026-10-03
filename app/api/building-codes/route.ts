import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { fetchWithTimeout } from '../../../lib/api-security'

const SOURCE = 'https://www.iccsafe.org/about-icc/overview-of-the-icc/international-code-adoptions/'
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const zip = request.nextUrl.searchParams.get('zip')?.trim() ?? ''
  const category = request.nextUrl.searchParams.get('category')?.trim() || 'Roofing'
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return NextResponse.json({ error: 'Enter a valid five-digit ZIP code.' }, { status: 400 })
  if (category.length > 80) return NextResponse.json({ error: 'Category must be 80 characters or fewer.' }, { status: 400 })
  const response = await fetchWithTimeout(`https://api.zippopotam.us/us/${zip.slice(0, 5)}`, { headers: { accept: 'application/json' }, cache: 'no-store' }, 5_000).catch(() => null)
  if (!response) return NextResponse.json({ error: 'ZIP locality lookup is temporarily unavailable.' }, { status: 503 })
  if (!response.ok) return NextResponse.json({ error: 'ZIP code could not be resolved.' }, { status: 404 })
  const locality = await response.json().catch(() => null) as { places?: Array<Record<string, string>> } | null
  if (!locality || !Array.isArray(locality.places)) return NextResponse.json({ error: 'ZIP locality service returned an invalid response.' }, { status: 502 })
  const place = locality.places?.[0]
  if (!place) return NextResponse.json({ error: 'No locality was returned for that ZIP code.' }, { status: 404 })
  const state = place['state abbreviation'] as string
  return NextResponse.json({
    jurisdiction: {
      zip: zip.slice(0, 5),
      city: place['place name'],
      state,
      stateName: place.state,
      countyCandidates: locality.places.map((item: Record<string, string>) => item['place name']),
      category,
    },
    code: {
      category,
      status: 'NOT_VERIFIED',
      message: `${category} requirements for ${place['place name']}, ${state} require confirmation from the applicable local permitting authority.`,
    },
    provenance: {
      localitySource: 'Zippopotam.us ZIP locality service',
      codeSource: SOURCE,
      codeSourceDescription: 'ICC code-adoption reference only; it does not establish current local requirements.',
      retrievedAt: new Date().toISOString(),
      confidence: 'jurisdiction-resolved; code content requires human verification',
    },
    warning: 'This lookup identifies the ZIP locality and state code family. It is not legal advice and must be checked against the local permitting authority before use.',
  })
}
