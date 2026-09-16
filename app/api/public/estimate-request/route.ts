import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  let body: { name?: string; address?: string; phone?: string; email?: string; notes?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const name = body.name?.trim() ?? ''
  const address = body.address?.trim() ?? ''
  if (name.length < 2) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (address.length < 8) return NextResponse.json({ error: 'A real property address is required. A photo is not an address.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const workspaceId = process.env.INTAKE_WORKSPACE_ID
  if (!url || !service || !workspaceId) {
    return NextResponse.json({ error: 'Intake is not configured. Set INTAKE_WORKSPACE_ID and the service role on the server.' }, { status: 503 })
  }

  const supabase = createClient(url, service)
  const { data, error } = await supabase.from('leads').insert({
    workspace_id: workspaceId,
    name,
    address,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    source: 'homeowner_web',
    notes: body.notes?.trim() || 'Homeowner web request. Photo may follow. Address supplied by homeowner.',
    status: 'new',
  }).select('id').single()

  if (error || !data) return NextResponse.json({ error: 'Could not save the request.', detail: error?.message }, { status: 502 })

  await supabase.from('lead_activity').insert({
    lead_id: data.id,
    workspace_id: workspaceId,
    kind: 'note',
    body: 'Homeowner submitted address with estimate request. Human must draft and send.',
  })

  return NextResponse.json({ ok: true, id: data.id })
}
