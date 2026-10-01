import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '../../../../lib/supabase/admin'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()
  const publicUrl = process.env.RECEPTIONIST_PUBLIC_URL?.trim()
  if (!accountSid || !authToken || !from || !publicUrl) return NextResponse.json({ error: 'Twilio and receptionist configuration is incomplete.' }, { status: 503 })
  const hour = new Date().getHours()
  if (hour < 8 || hour >= 20) return NextResponse.json({ processed: 0, skipped: 'quiet_hours' })
  const admin = createAdminClient()
  const { data: attempts, error } = await admin.from('receptionist_call_attempts').select('id,workspace_id,lead_id,phone,attempt_number').eq('direction', 'outbound').eq('status', 'queued').not('next_attempt_at', 'is', null).lte('next_attempt_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(25)
  if (error) return NextResponse.json({ error: 'Could not read follow-up queue.', detail: error.message }, { status: 502 })
  const client = twilio(accountSid, authToken)
  let started = 0
  for (const attempt of attempts || []) {
    const { data: claimed } = await admin.from('receptionist_call_attempts').update({ status: 'ringing' }).eq('id', attempt.id).eq('status', 'queued').select('id').maybeSingle()
    if (!claimed) continue
    const { data: optOut } = await admin.from('receptionist_consents').select('id').eq('workspace_id', attempt.workspace_id).eq('phone', attempt.phone).eq('channel', 'voice').eq('state', 'revoked').order('captured_at', { ascending: false }).limit(1).maybeSingle()
    if (optOut) {
      await admin.from('receptionist_call_attempts').update({ status: 'opted_out' }).eq('id', attempt.id)
      continue
    }
    try {
      const call = await client.calls.create({ to: attempt.phone, from, url: `${publicUrl}/api/receptionist/twilio/outbound/twiml?message=${encodeURIComponent('This is a follow-up from Roof OS. Please tell me how I can help.')}`, statusCallback: `${publicUrl}/api/receptionist/twilio/status`, statusCallbackMethod: 'POST' })
      await admin.from('receptionist_call_attempts').update({ provider_call_id: call.sid }).eq('id', attempt.id).eq('status', 'ringing')
      started += 1
    } catch (callError) {
      await admin.from('receptionist_call_attempts').update({ status: 'failed' }).eq('id', attempt.id).eq('status', 'ringing')
      await admin.from('receptionist_events').upsert({ workspace_id: attempt.workspace_id, event_key: `followup:${attempt.id}:failed`, event_type: 'follow_up.failed', provider: 'twilio', payload: { attemptId: attempt.id, error: callError instanceof Error ? callError.message : 'Twilio call failed' } }, { onConflict: 'workspace_id,event_key' })
    }
  }
  return NextResponse.json({ processed: attempts?.length || 0, started })
}
