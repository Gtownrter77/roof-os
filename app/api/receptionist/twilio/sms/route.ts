import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { createClient } from '../../../../../lib/supabase/server'
import { receptionistConfig, recordConsent } from '../../../../../lib/receptionist-actions'
import { assertTwilioRequest } from '../../../../../lib/receptionist-twilio'

const OPT_OUT_WORDS = new Set(['stop', 'unsubscribe', 'cancel', 'end', 'quit'])

export async function POST(request: NextRequest) {
  const params = Object.fromEntries((await request.formData()).entries()) as Record<string, string>
  try {
    assertTwilioRequest(request, params)
    const { workspaceId } = receptionistConfig()
    const admin = createAdminClient()
    const from = params.From || ''
    const body = (params.Body || '').trim().toLowerCase()
    if (!from) return new Response('Missing sender', { status: 400 })
    if (OPT_OUT_WORDS.has(body)) {
      await recordConsent({ workspaceId, phone: from, channel: 'sms', state: 'revoked', source: 'twilio_sms_opt_out' })
      await admin.from('receptionist_events').upsert({ workspace_id: workspaceId, event_key: `twilio:${params.MessageSid || from}:optout`, event_type: 'sms.opt_out', provider: 'twilio', payload: { from, body: params.Body || '' } }, { onConflict: 'workspace_id,event_key' })
      return new Response('You are unsubscribed from Roof OS messages.', { status: 200 })
    }
    await admin.from('receptionist_events').upsert({ workspace_id: workspaceId, event_key: `twilio:${params.MessageSid || from}:received`, event_type: 'sms.received', provider: 'twilio', payload: { from, body: params.Body || '' } }, { onConflict: 'workspace_id,event_key' })
    return new Response('ok')
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid Twilio request', { status: 403 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()
  if (!accountSid || !authToken || !from) return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 503 })
  let body: { phone?: string; message?: string; leadId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const phone = body.phone?.trim()
  const message = body.message?.trim()
  if (!phone || !message) return NextResponse.json({ error: 'phone and message are required.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: optOut } = await admin.from('receptionist_consents').select('id').eq('workspace_id', workspaceId).eq('phone', phone).eq('channel', 'sms').eq('state', 'revoked').order('captured_at', { ascending: false }).limit(1).maybeSingle()
  if (optOut) return NextResponse.json({ error: 'This phone number has opted out of SMS follow-up.' }, { status: 409 })
  const sms = await twilio(accountSid, authToken).messages.create({ to: phone, from, body: message })
  await admin.from('receptionist_events').upsert({ workspace_id: workspaceId, event_key: `twilio:${sms.sid}:sent`, event_type: 'sms.sent', provider: 'twilio', payload: { phone, leadId: body.leadId || null, messageSid: sms.sid, createdBy: user.id } }, { onConflict: 'workspace_id,event_key' })
  return NextResponse.json({ messageId: sms.sid, provider: 'twilio' }, { status: 202 })
}
