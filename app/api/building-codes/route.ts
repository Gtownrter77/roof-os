import { NextRequest, NextResponse } from 'next/server'

const SOURCE = 'https://www.iccsafe.org/about-icc/overview-of-the-icc/international-code-adoptions/'
const STATE_CODES: Record<string, { code: string; edition: string; notes: string[] }> = {
  GA: { code: 'Georgia State Minimum Standard Codes', edition: '2024 reference; verify local amendments', notes: ['Georgia adopts statewide minimum codes with local enforcement.', 'Local permitting authority and amendments must be confirmed before quoting requirements.'] },
  FL: { code: 'Florida Building Code', edition: 'Current edition must be verified with Florida Building Commission', notes: ['Wind-borne debris and product approvals can vary by location.', 'Confirm flood, wind, and local permit requirements.'] },
  CA: { code: 'California Building Standards Code, Title 24', edition: 'Current edition must be verified with local authority', notes: ['Wildland-urban interface, energy, and local amendments may apply.', 'Confirm city/county permit requirements.'] },
  TX: { code: 'Texas building-code reference', edition: 'Local adoption varies; verify municipality', notes: ['Texas jurisdictions may adopt different editions and amendments.', 'Confirm city/county and windstorm authority.'] },
  NY: { code: 'New York State Uniform Code', edition: 'Current edition must be verified with local authority', notes: ['Local enforcement and energy-code requirements must be confirmed.', 'Confirm municipality and permit pathway.'] },
}

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get('zip')?.trim() ?? ''
  const category = request.nextUrl.searchParams.get('category')?.trim() || 'Roofing'
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return NextResponse.json({ error: 'Enter a valid five-digit ZIP code.' }, { status: 400 })
  const response = await fetch(`https://api.zippopotam.us/us/${zip.slice(0, 5)}`, { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) return NextResponse.json({ error: 'ZIP code could not be resolved.' }, { status: 404 })
  const locality = await response.json()
  const place = locality.places?.[0]
  if (!place) return NextResponse.json({ error: 'No locality was returned for that ZIP code.' }, { status: 404 })
  const state = place['state abbreviation'] as string
  const reference = STATE_CODES[state] ?? { code: `${state} building-code reference`, edition: 'Verify current state and local adoption', notes: ['No state-specific record is configured yet.', 'Confirm the local authority before relying on this result.'] }
  return NextResponse.json({ jurisdiction: { zip: zip.slice(0, 5), city: place['place name'], state, stateName: place.state, countyCandidates: locality.places.map((item: Record<string, string>) => item['place name']), category }, code: { ...reference, requirements: [`${category} requirements require local-authority confirmation for ${place['place name']}, ${state}.`, ...reference.notes] }, provenance: { localitySource: 'Zippopotam.us ZIP locality service', codeSource: SOURCE, retrievedAt: new Date().toISOString(), confidence: 'jurisdiction-resolved; code content requires human verification' }, warning: 'This lookup identifies the ZIP locality and state code family. It is not legal advice and must be checked against the local permitting authority before use.' })
}
