import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '../../../../../lib/supabase/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()
  const publicUrl = process.env.RECEPTIONIST_PUBLIC_URL?.trim()
  if (!accountSid || !authToken || !from || !publicUrl) return NextResponse.json({ error: 'Twilio and receptionist configuration is incomplete.' }, { status: 503 })
  let body: { leadId?: string; phone?: string; message?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const phone = body.phone?.trim()
  if (!phone || !body.message?.trim()) return NextResponse.json({ error: 'phone and message are required.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: optOut } = await admin.from('receptionist_consents').select('id').eq('workspace_id', workspaceId).eq('phone', phone).eq('channel', 'voice').eq('state', 'revoked').order('captured_at', { ascending: false }).limit(1).maybeSingle()
  if (optOut) return NextResponse.json({ error: 'This phone number has opted out of voice follow-up.' }, { status: 409 })
  const hour = new Date().getHours()
  if (hour < 8 || hour >= 20) return NextResponse.json({ error: 'Outbound calls are restricted to local quiet hours.' }, { status: 409 })
  const client = twilio(accountSid, authToken)
  const call = await client.calls.create({ to: phone, from, url: `${publicUrl}/api/receptionist/twilio/outbound/twiml?message=${encodeURIComponent(body.message.trim())}`, statusCallback: `${publicUrl}/api/receptionist/twilio/status`, statusCallbackMethod: 'POST' })
  await admin.from('receptionist_call_attempts').insert({ workspace_id: workspaceId, lead_id: body.leadId || null, phone, direction: 'outbound', attempt_number: 1, status: 'ringing', provider_call_id: call.sid })
  return NextResponse.json({ callId: call.sid, provider: 'twilio' }, { status: 202 })
}
