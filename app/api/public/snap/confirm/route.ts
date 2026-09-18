import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  let body: { address?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const address = body.address?.trim() ?? ''
  if (address.length < 8) return NextResponse.json({ error: 'Verify a real address.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const workspaceId = process.env.INTAKE_WORKSPACE_ID
  if (!url || !service || !workspaceId) {
    return NextResponse.json({ error: 'Intake is not configured on the server.' }, { status: 503 })
  }

  const supabase = createClient(url, service)
  const { data, error } = await supabase.from('leads').insert({
    workspace_id: workspaceId,
    name: address.split(',')[0] || 'Snap lead',
    address,
    source: 'snap_photo',
    notes: 'Address drafted from photo. Homeowner verified.',
    status: 'new',
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Could not open the file.', detail: error?.message }, { status: 502 })
  return NextResponse.json({ ok: true, id: data.id })
}
