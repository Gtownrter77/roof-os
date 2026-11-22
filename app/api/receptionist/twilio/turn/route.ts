import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { generateReceptionistTurn } from '../../../../../lib/receptionist-ai'
import { bookAppointment, receptionistConfig, resolveLead, recordConsent } from '../../../../../lib/receptionist-actions'
import { assertTwilioRequest, speechGather, twiml, xmlEscape } from '../../../../../lib/receptionist-twilio'
import { loadWorkspaceSettings } from '../../../../../lib/workspace-settings'
import { sessionLookupFailureStatus, shouldAppendTurn } from '../../../../../lib/receptionist/turn-status'

function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Durable session/audit state written during a turn must never be reported as
// persisted when the write failed: Twilio treats a valid TwiML response as the
// end of the callback and will not retry. A distinct retryable error keeps the
// successful conversation flow intact while making persistence loss visible.
class ReceptionistWriteError extends Error {}

function checkedWrite(result: { error: { message: string } | null }, label: string) {
  if (result.error) throw new ReceptionistWriteError(`Could not persist ${label}: ${result.error.message}`)
}

export async function POST(request: NextRequest) {
  const params = Object.fromEntries((await request.formData()).entries()) as Record<string, string>
  try {
    assertTwilioRequest(request, params)
    const { workspaceId, ownerId, publicUrl } = receptionistConfig()
    const supabase = createAdminClient()
    const settings = await loadWorkspaceSettings(supabase, workspaceId)
    if (!settings.enable_ai_receptionist) {
      const transferNumber = process.env.RECEPTIONIST_TRANSFER_NUMBER?.trim()
      if (transferNumber) return twiml(`<Say>The automated assistant is turned off. Connecting you with a team member now. Please hold.</Say><Dial>${xmlEscape(transferNumber)}</Dial>`)
      return twiml('<Say>This office has turned off the automated assistant. Please call back during business hours. Goodbye.</Say><Hangup/>')
    }
    const callSid = params.CallSid
    const speech = params.SpeechResult?.trim()

    if (!callSid || !speech) {
      return twiml('<Say>I did not hear a request. I can connect you with a team member. Goodbye.</Say><Hangup/>')
    }

    const transferNumber = process.env.RECEPTIONIST_TRANSFER_NUMBER?.trim()
    const isHumanTransferKeyword = /human|operator|representative|agent|person|speak to someone/i.test(speech)
    if (isHumanTransferKeyword && transferNumber) {
      return twiml(`<Say>Connecting you with a team member now. Please hold.</Say><Dial>${xmlEscape(transferNumber)}</Dial>`)
    }

    const { data: session, error: sessionError } = await supabase
      .from('receptionist_sessions')
      .select('id,caller_phone,lead_id,transcript')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'twilio')
      .eq('provider_session_id', callSid)
      .single()

    // `.single()` reports zero rows as PGRST116 with a non-null error, so the
    // no-session case must stay a 404 while real lookup failures stay 503.
    const lookupFailure = sessionLookupFailureStatus(sessionError, Boolean(session))
    if (lookupFailure === 404) return new Response('Receptionist session not found', { status: 404 })
    if (lookupFailure === 503) return new Response('Receptionist session lookup failed', { status: 503 })

    let turn
    try {
      turn = await generateReceptionistTurn({ transcript: speech, callerPhone: session.caller_phone || undefined, history: session.transcript ? [session.transcript] : [] })
    } catch {
      if (transferNumber) {
        return twiml(`<Say>I am having trouble processing that right now. Connecting you directly with our team.</Say><Dial>${xmlEscape(transferNumber)}</Dial>`)
      }
      return twiml('<Say>I am having trouble processing that right now. A team member will follow up with you shortly. Goodbye.</Say><Hangup/>')
    }

    // Every branch writes its own state first and defers the response. The
    // transcript is deliberately the LAST durable write: if any branch write
    // fails, we return 502 before recording the turn, so a Twilio retry starts
    // from the identical stored transcript. That removes duplicate turns even
    // when the regenerated LLM reply differs between attempts.
    let response: Response
    if (turn.intent === 'opt_out') {
      await recordConsent({ workspaceId, leadId: session.lead_id || undefined, phone: session.caller_phone || '', channel: 'voice', state: 'revoked', source: 'twilio_voice' })
      checkedWrite(await supabase.from('receptionist_sessions').update({ status: 'opted_out', outcome: 'voice_opt_out', ended_at: new Date().toISOString() }).eq('id', session.id), 'voice opt-out session state')
      response = twiml(`<Say>${xmlEscape(turn.reply)}</Say><Hangup/>`)
    } else if (turn.intent === 'human') {
      checkedWrite(await supabase.from('receptionist_sessions').update({ status: 'transferred', outcome: 'human_transfer_requested', ended_at: new Date().toISOString() }).eq('id', session.id), 'human transfer session state')
      response = !transferNumber
        ? twiml(`<Say>${xmlEscape(turn.reply)} Our team will follow up shortly.</Say><Hangup/>`)
        : twiml(`<Say>${xmlEscape(turn.reply)}</Say><Dial>${xmlEscape(transferNumber)}</Dial>`)
    } else {
      const lead = await resolveLead({ workspaceId, ownerId, phone: session.caller_phone || '', name: turn.callerName, address: turn.address })
      if (!session.lead_id) checkedWrite(await supabase.from('receptionist_sessions').update({ lead_id: lead.id }).eq('id', session.id), 'lead linkage')

      if (turn.intent === 'schedule' && turn.requestedDateTime) {
        const requestedStart = new Date(turn.requestedDateTime)
        const requestedEnd = new Date(requestedStart.getTime() + 30 * 60 * 1000)

        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id')
          .eq('workspace_id', workspaceId)
          .gte('ends_at', requestedStart.toISOString())
          .lte('starts_at', requestedEnd.toISOString())
          .limit(1)

        if (conflicts && conflicts.length > 0) {
          response = twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, 'That appointment slot conflicts with an existing booking. Please suggest another preferred time.'))
        } else {
          try {
            const appointment = await bookAppointment({ workspaceId, leadId: lead.id, startsAt: turn.requestedDateTime, title: `Inspection: ${lead.name}`, address: lead.address, idempotencyKey: `twilio:${callSid}:appointment` })
            checkedWrite(await supabase.from('receptionist_sessions').update({ status: 'completed', outcome: 'appointment_booked', ended_at: new Date().toISOString() }).eq('id', session.id), 'appointment outcome')
            response = twiml(`<Say>${xmlEscape(`You are booked for ${new Date(appointment.starts_at).toLocaleString()}. ${turn.reply}`)}</Say><Hangup/>`)
          } catch (error) {
            // A persistence failure is not an unavailable appointment slot; it must
            // reach the outer handler so Twilio can retry the callback.
            if (error instanceof ReceptionistWriteError) throw error
            response = twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, 'That time is not available. Please tell me another preferred day and time.'))
          }
        }
      } else {
        if (turn.intent === 'follow_up') {
          if (settings.enable_auto_followup_tasks) {
            // A deterministic id makes the insert idempotent across webhook retries.
            const taskId = deterministicUuid(`twilio:${callSid}:followup-task`)
            checkedWrite(await supabase.from('tasks').upsert({ id: taskId, workspace_id: workspaceId, lead_id: lead.id, title: 'AI receptionist follow-up', notes: speech, created_by: ownerId, status: 'open' }, { onConflict: 'id' }), 'follow-up task')
          }
          if (session.caller_phone) {
            const nextAttemptAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
            checkedWrite(await supabase.from('receptionist_call_attempts').upsert({ workspace_id: workspaceId, lead_id: lead.id, phone: session.caller_phone, direction: 'outbound', attempt_number: 1, status: 'queued', next_attempt_at: nextAttemptAt }, { onConflict: 'workspace_id,lead_id,phone,direction,attempt_number' }), 'follow-up call attempt')
          }
          checkedWrite(await supabase.from('receptionist_sessions').update({ status: 'completed', outcome: 'follow_up_task_created', ended_at: new Date().toISOString() }).eq('id', session.id), 'follow-up outcome')
        }
        response = twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, turn.reply))
      }
    }

    // Last durable write. The trailing-pair check is a best-effort guard for a
    // lost response after every write succeeded; the ordering above is the
    // primary protection against a retry duplicating this turn.
    const callerLine = `Caller: ${speech}`
    const assistantLine = `Assistant: ${turn.reply}`
    const existingTranscript = session.transcript || ''
    const transcript = shouldAppendTurn(existingTranscript, callerLine, assistantLine)
      ? [existingTranscript, callerLine, assistantLine].filter(Boolean).join('\n')
      : existingTranscript
    checkedWrite(await supabase.from('receptionist_sessions').update({ transcript, updated_at: new Date().toISOString() }).eq('id', session.id), 'call transcript')

    return response
  } catch (error) {
    if (error instanceof ReceptionistWriteError) return new Response('Receptionist state could not be persisted', { status: 502 })
    return new Response('Invalid Twilio request', { status: 403 })
  }
}
