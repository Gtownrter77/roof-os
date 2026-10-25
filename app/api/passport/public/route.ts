import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { isUuid } from '../../../../lib/api-security'

export const runtime = 'nodejs'

const PUBLIC_FIELDS = 'property_address, homeowner_name, material_system, manufacturer, color, install_date, status'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token || !isUuid(token)) {
    return NextResponse.json({ error: 'A valid share token is required.' }, { status: 400 })
  }

  const admin = createAdminClient()
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
