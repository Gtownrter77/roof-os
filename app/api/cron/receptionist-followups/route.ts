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
  let failed = 0
  let optedOut = 0
  const failures: Array<{ attemptId: string; error: string }> = []

  for (const attempt of attempts || []) {
    const { data: claimed } = await admin.from('receptionist_call_attempts').update({ status: 'ringing' }).eq('id', attempt.id).eq('status', 'queued').select('id').maybeSingle()
    if (!claimed) continue
    const { data: consent } = await admin.from('receptionist_consents').select('state,expires_at').eq('workspace_id', attempt.workspace_id).eq('phone', attempt.phone).eq('channel', 'voice').order('captured_at', { ascending: false }).limit(1).maybeSingle()
    if (consent?.state !== 'granted' || (consent.expires_at && new Date(consent.expires_at).getTime() <= Date.now())) {
      await admin.from('receptionist_call_attempts').update({ status: 'opted_out' }).eq('id', attempt.id)
      optedOut += 1
      continue
    }
    try {
      const call = await client.calls.create({ to: attempt.phone, from, url: `${publicUrl}/api/receptionist/twilio/outbound/twiml?message=${encodeURIComponent('This is a follow-up from Roof OS. Please tell me how I can help.')}`, statusCallback: `${publicUrl}/api/receptionist/twilio/status`, statusCallbackMethod: 'POST' })
      await admin.from('receptionist_call_attempts').update({ provider_call_id: call.sid }).eq('id', attempt.id).eq('status', 'ringing')
      started += 1
    } catch (callError) {
      const errorMessage = callError instanceof Error ? callError.message : 'Twilio call failed'
      await admin.from('receptionist_call_attempts').update({ status: 'failed' }).eq('id', attempt.id).eq('status', 'ringing')
      await admin.from('receptionist_events').upsert({ workspace_id: attempt.workspace_id, event_key: `followup:${attempt.id}:failed`, event_type: 'follow_up.failed', provider: 'twilio', payload: { attemptId: attempt.id, error: errorMessage } }, { onConflict: 'workspace_id,event_key' })

      const maxAttempts = 3
      if (attempt.attempt_number < maxAttempts) {
        const nextAttemptNumber = attempt.attempt_number + 1
        const backoffHours = attempt.attempt_number === 1 ? 1 : 4
        const nextAttemptAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000).toISOString()
        const { error: retryError } = await admin.from('receptionist_call_attempts').insert({
          workspace_id: attempt.workspace_id,
          lead_id: attempt.lead_id,
          phone: attempt.phone,
          direction: 'outbound',
          attempt_number: nextAttemptNumber,
          status: 'queued',
          next_attempt_at: nextAttemptAt,
        })
        if (retryError) {
          failures.push({ attemptId: attempt.id, error: `${errorMessage}; retry scheduling failed: ${retryError.message}` })
        }
      }

      failed += 1
      if (!failures.some((failure) => failure.attemptId === attempt.id)) {
        failures.push({ attemptId: attempt.id, error: errorMessage })
      }
    }
  }

  if (failed > 0) {
    return NextResponse.json({ processed: attempts?.length || 0, started, optedOut, failed, failures }, { status: 502 })
  }

  return NextResponse.json({ processed: attempts?.length || 0, started, optedOut, failed: 0 })
}
