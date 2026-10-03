import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, isUuid, requireWorkspaceMember } from '../../../../lib/api-security'

const NWS_API = 'https://api.weather.gov'
const USER_AGENT = 'ROOF-OS/1.0 (contact: admin@roof-os.local)'
const WEATHER_EVENTS = /hail|tornado|thunderstorm|wind|hurricane|tropical|flood|ice|winter storm|derecho/i

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const workspaceId = params.get('workspaceId')
  const inspectionId = params.get('inspectionId')
  const latitude = Number(params.get('latitude'))
  const longitude = Number(params.get('longitude'))
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  if (!isUuid(inspectionId)) return NextResponse.json({ error: 'A saved inspection is required.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const { data: inspection, error: inspectionError } = await supabase.from('inspection_sessions').select('id').eq('id', inspectionId).eq('workspace_id', workspaceId).maybeSingle()
  if (inspectionError) return NextResponse.json({ error: 'Could not load the inspection.' }, { status: 503 })
  if (!inspection) return NextResponse.json({ error: 'That inspection is not in this workspace.' }, { status: 404 })
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return NextResponse.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 })

  const url = `${NWS_API}/alerts?point=${encodeURIComponent(`${latitude},${longitude}`)}&limit=50`
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/geo+json', 'user-agent': USER_AGENT }, cache: 'no-store' })
  if (!response.ok) return NextResponse.json({ error: 'NOAA NWS lookup failed.', status: response.status }, { status: 502 })
  const payload = await response.json()
  const candidates = (payload.features ?? []).filter((feature: any) => WEATHER_EVENTS.test(`${feature.properties?.event ?? ''} ${feature.properties?.headline ?? ''}`)).map((feature: any) => ({
    eventType: feature.properties?.event ?? 'Unknown',
    eventDate: feature.properties?.onset ?? feature.properties?.effective ?? null,
    expires: feature.properties?.expires ?? null,
    severity: feature.properties?.severity ?? null,
    headline: feature.properties?.headline ?? null,
    sourceUrl: feature.id ?? url,
    confidence: 'candidate',
  }))

  if (candidates.length) {    const urls = candidates.map((c: any) => c.sourceUrl).filter(Boolean);    const { data: existing } = await supabase.from("storm_evidence").select("source_url").eq("workspace_id", workspaceId).in("source_url", urls);    const existingUrls = new Set((existing ?? []).map((e: any) => e.source_url));    const toInsert = candidates.filter((c: any) => c.eventDate && !existingUrls.has(c.sourceUrl)).map((candidate: any) => ({ workspace_id: workspaceId, inspection_id: inspectionId, provider: "nws", event_type: candidate.eventType, event_date: candidate.eventDate.slice(0, 10), severity: candidate.severity, confidence: "candidate", source_url: candidate.sourceUrl, source_payload: candidate, created_by: user.id }));    if (toInsert.length) await supabase.from("storm_evidence").insert(toInsert);  }

  return NextResponse.json({ provider: 'nws', candidates, interpretation: 'Candidate weather evidence only. NOAA proximity or an alert does not prove property damage or a date of loss. Human review and corroboration are required.', sourceUrl: url })
}
