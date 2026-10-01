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
    if (!callSid) return new Response('Missing CallSid', { status: 400 })
    const status = callStatus === 'completed' ? 'completed' : callStatus === 'busy' || callStatus === 'no-answer' ? 'failed' : 'active'
    await supabase.from('receptionist_sessions').update({ status, outcome: `twilio_${callStatus}`, ended_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null }).eq('workspace_id', workspaceId).eq('provider', 'twilio').eq('provider_session_id', callSid)
    await supabase.from('receptionist_events').upsert({ workspace_id: workspaceId, event_key: `twilio:${callSid}:${callStatus}`, event_type: 'call.status', provider: 'twilio', payload: params }, { onConflict: 'workspace_id,event_key' })
    return new Response('ok')
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid Twilio request', { status: 403 })
  }
}
