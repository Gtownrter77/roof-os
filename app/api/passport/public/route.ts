import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { isUuid } from '../../../../lib/api-security'

export const runtime = 'nodejs'

const PUBLIC_FIELDS = 'property_address, homeowner_name, material_system, manufacturer, color, install_date, status'
const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 60

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token')?.trim()
  if (!rawToken || !isUuid(rawToken)) {
    return NextResponse.json({ error: 'A valid share token is required.' }, { status: 400 })
  }
  const token = rawToken.toLowerCase()

  const admin = createAdminClient()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
  const bucket = createHash('sha256').update(`${ip}:${token}`).digest('hex').slice(0, 40)
  const { data: allowed, error: rateError } = await admin.rpc('consume_public_rate_limit', {
    p_bucket: bucket,
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW_SECONDS,
  })
  if (rateError) {
    return NextResponse.json({ error: 'Passport lookup is temporarily unavailable.' }, { status: 503 })
  }
  if (allowed !== true) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS) } })
  }

  const { data, error } = await admin
    .from('roof_passports')
    .select(PUBLIC_FIELDS)
    .eq('public_token', token)
    .eq('public_shared', true)
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Passport could not be loaded.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'This passport link is not available.' }, { status: 404 })

  return NextResponse.json({ passport: data }, { headers: { 'Cache-Control': 'no-store' } })
}
