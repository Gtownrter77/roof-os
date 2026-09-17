import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { generateReceptionistTurn } from '../../../../../lib/receptionist-ai'
import { bookAppointment, receptionistConfig, resolveLead, recordConsent } from '../../../../../lib/receptionist-actions'
import { assertTwilioRequest, speechGather, twiml, xmlEscape } from '../../../../../lib/receptionist-twilio'

export async function POST(request: NextRequest) {
  const params = Object.fromEntries((await request.formData()).entries()) as Record<string, string>
  try {
    assertTwilioRequest(request, params)
    const { workspaceId, ownerId, publicUrl } = receptionistConfig()
    const supabase = createAdminClient()
    const callSid = params.CallSid
    const speech = params.SpeechResult?.trim()
    if (!callSid || !speech) return twiml('<Say>I did not hear a request. I can connect you with a team member. Goodbye.</Say><Hangup/>')
    const { data: session, error: sessionError } = await supabase.from('receptionist_sessions').select('id,caller_phone,lead_id,transcript').eq('provider', 'twilio').eq('provider_session_id', callSid).single()
    if (sessionError || !session) return new Response('Receptionist session not found', { status: 404 })
    const turn = await generateReceptionistTurn({ transcript: speech, callerPhone: session.caller_phone || undefined, history: session.transcript ? [session.transcript] : [] })
    const transcript = [session.transcript, `Caller: ${speech}`, `Assistant: ${turn.reply}`].filter(Boolean).join('\n')
    await supabase.from('receptionist_sessions').update({ transcript, updated_at: new Date().toISOString() }).eq('id', session.id)

    if (turn.intent === 'opt_out') {
      await recordConsent({ workspaceId, leadId: session.lead_id || undefined, phone: session.caller_phone || '', channel: 'voice', state: 'revoked', source: 'twilio_voice' })
      await supabase.from('receptionist_sessions').update({ status: 'opted_out', outcome: 'voice_opt_out', ended_at: new Date().toISOString() }).eq('id', session.id)
      return twiml(`<Say>${xmlEscape(turn.reply)}</Say><Hangup/>`)
    }
    if (turn.intent === 'human') {
      await supabase.from('receptionist_sessions').update({ status: 'transferred', outcome: 'human_transfer_requested', ended_at: new Date().toISOString() }).eq('id', session.id)
      const transferNumber = process.env.RECEPTIONIST_TRANSFER_NUMBER?.trim()
      if (!transferNumber) return twiml(`<Say>${xmlEscape(turn.reply)} Our team will follow up shortly.</Say><Hangup/>`)
      return twiml(`<Say>${xmlEscape(turn.reply)}</Say><Dial>${xmlEscape(transferNumber)}</Dial>`)
    }

    const lead = await resolveLead({ workspaceId, ownerId, phone: session.caller_phone || '', name: turn.callerName, address: turn.address })
    if (!session.lead_id) await supabase.from('receptionist_sessions').update({ lead_id: lead.id }).eq('id', session.id)
    if (turn.intent === 'schedule' && turn.requestedDateTime) {
      try {
        const appointment = await bookAppointment({ workspaceId, leadId: lead.id, startsAt: turn.requestedDateTime, title: `Inspection: ${lead.name}`, address: lead.address, idempotencyKey: `twilio:${callSid}:appointment` })
        await supabase.from('receptionist_sessions').update({ status: 'completed', outcome: 'appointment_booked', ended_at: new Date().toISOString() }).eq('id', session.id)
        return twiml(`<Say>${xmlEscape(`You are booked for ${new Date(appointment.starts_at).toLocaleString()}. ${turn.reply}`)}</Say><Hangup/>`)
      } catch {
        return twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, 'That time is not available. Please tell me another preferred day and time.'))
      }
    }
    if (turn.intent === 'follow_up') {
      await supabase.from('tasks').insert({ workspace_id: workspaceId, lead_id: lead.id, title: 'AI receptionist follow-up', notes: speech, created_by: ownerId, status: 'open' })
      if (session.caller_phone) {
        const nextAttemptAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        await supabase.from('receptionist_call_attempts').upsert({ workspace_id: workspaceId, lead_id: lead.id, phone: session.caller_phone, direction: 'outbound', attempt_number: 1, status: 'queued', next_attempt_at: nextAttemptAt }, { onConflict: 'workspace_id,lead_id,phone,direction,attempt_number' })
      }
      await supabase.from('receptionist_sessions').update({ status: 'completed', outcome: 'follow_up_task_created', ended_at: new Date().toISOString() }).eq('id', session.id)
    }
    return twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, turn.reply))
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Receptionist turn failed', { status: 403 })
  }
}
