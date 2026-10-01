import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { fetchWithTimeout } from '../../../lib/api-security'

const SOURCE = 'https://www.iccsafe.org/about-icc/overview-of-the-icc/international-code-adoptions/'
const STATE_CODES: Record<string, { code: string; edition: string; notes: string[] }> = {
  TX: { code: "Texas 2021 IRC / TDI Windstorm Code", edition: "2021 International Residential Code w/ TDI Windstorm Field Requirements", notes: ["IRC § R905.2.8.5 Drip Edge required on all eaves and rakes.", "TDI designated catastrophe counties require WPI-8 engineering certification for wind coverage."] },
  OK: { code: "Oklahoma Uniform Building Code Commission 2021 IRC", edition: "2021 IRC Statewide Adoption", notes: ["IRC § R905.1.2 Valley ice barrier protection mandatory in freezing zones.", "High wind fastener spacing required (6 nails per shingle)."] },
  CO: { code: "Colorado Municipal Building Code (Regional Building Department)", edition: "2021 IRC w/ High Altitude Amendments", notes: ["Ice & water shield required 24\" inside warm wall perimeter.", "Class 4 Impact Resistant shingles recommended for severe hail corridors."] },
  KS: { code: "Kansas Municipal Model Codes", edition: "2018/2021 IRC Local Municipalities", notes: ["Drip edge required by manufacturer specifications and IRC R905.2.8.5.", "Verify local city permit requirements."] },
  MO: { code: "Missouri Local Jurisdiction Building Codes", edition: "2021 IRC Local Adoption", notes: ["Check St. Louis and Kansas City metropolitan amendments.", "Solid sheathing required per IRC R905.2.1."] },
  FL: { code: "Florida Building Code 8th Edition (2023)", edition: "FBC 8th Edition Residential", notes: ["Sealed roof deck required (Option 1 or Option 2).", "All asphalt shingles must meet ASTM D3161 Class F or ASTM D7158 Class H."] },
  GA: { code: "Georgia State Minimum Standard Codes", edition: "2024 reference; verify local amendments", notes: ["Georgia adopts statewide minimum codes with local enforcement.", "Local permitting authority and amendments must be confirmed before quoting requirements."] },
  CA: { code: "California Building Standards Code, Title 24", edition: "Current edition must be verified with local authority", notes: ["Wildland-urban interface (WUI) Class A fire rating required.", "Title 24 cool roof reflectivity standards apply in specified climate zones."] },
  NY: { code: "New York State Uniform Code", edition: "Current edition must be verified with local authority", notes: ["Local enforcement and energy-code requirements must be confirmed.", "Ice barrier required to 24 inches past interior wall line."] },
}

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
  const reference = STATE_CODES[state] ?? { code: `${state} building-code reference`, edition: 'Verify current state and local adoption', notes: ['No state-specific record is configured yet.', 'Confirm the local authority before relying on this result.'] }
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
      ...reference,
      requirements: [`${category} requirements require local-authority confirmation for ${place['place name']}, ${state}.`, ...reference.notes],
    },
    provenance: {
      localitySource: 'Zippopotam.us ZIP locality service',
      codeSource: SOURCE,
      retrievedAt: new Date().toISOString(),
      confidence: 'jurisdiction-resolved; code content requires human verification',
    },
    warning: 'This lookup identifies the ZIP locality and state code family. It is not legal advice and must be checked against the local permitting authority before use.',
  })
}
