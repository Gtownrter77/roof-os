import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { receptionistConfig } from '../../../../../lib/receptionist-actions'
import { assertTwilioRequest } from '../../../../../lib/receptionist-twilio'

export async function POST(request: NextRequest) {
  const params = Object.fromEntries((await request.formData()).entries()) as Record<string, string>
  try {
    assertTwilioRequest(request, params)
    const { workspaceId } = receptionistConfig()
    const supabase = createAdminClient()
    const callSid = params.CallSid
    const callStatus = params.CallStatus || 'unknown'
    const callDuration = params.CallDuration ? parseInt(params.CallDuration, 10) : null
    const recordingUrl = params.RecordingUrl || null

    if (!callSid) return new Response('Missing CallSid', { status: 400 })
    const status = callStatus === 'completed' ? 'completed' : callStatus === 'busy' || callStatus === 'no-answer' ? 'failed' : 'active'

    const { error: sessionUpdateError } = await supabase.from('receptionist_sessions').update({
      status,
      outcome: `twilio_${callStatus}`,
      ended_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
    }).eq('workspace_id', workspaceId).eq('provider', 'twilio').eq('provider_session_id', callSid)
    if (sessionUpdateError) return new Response('Could not update call session', { status: 502 })

    const { error: eventPersistError } = await supabase.from('receptionist_events').upsert({
      workspace_id: workspaceId,
      event_key: `twilio:${callSid}:${callStatus}`,
      event_type: 'call.status',
      provider: 'twilio',
      payload: { ...params, callDurationSeconds: callDuration, recordingUrl }
    }, { onConflict: 'workspace_id,event_key' })
    if (eventPersistError) return new Response('Could not persist call status event', { status: 502 })

    return new Response('ok')
  } catch {
    return new Response('Invalid Twilio request', { status: 403 })
  }
}
