import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { receptionistConfig } from '../../../../../lib/receptionist-actions'
import { assertTwilioRequest, speechGather, twiml } from '../../../../../lib/receptionist-twilio'
import { loadWorkspaceSettings } from '../../../../../lib/workspace-settings'

export async function POST(request: NextRequest) {
  const params = Object.fromEntries((await request.formData()).entries()) as Record<string, string>
  try {
    assertTwilioRequest(request, params)
    const { workspaceId, publicUrl } = receptionistConfig()
    const supabase = createAdminClient()
    const settings = await loadWorkspaceSettings(supabase, workspaceId)
    if (!settings.enable_ai_receptionist) {
      return twiml('<Say>This office has turned off the automated assistant. Please call back during business hours. Goodbye.</Say><Hangup/>')
    }
    const callSid = params.CallSid
    const from = params.From || ''
    if (!callSid || !from) return new Response('Missing call identity', { status: 400 })
    const { error } = await supabase.from('receptionist_sessions').upsert({ workspace_id: workspaceId, direction: 'inbound', channel: 'voice', provider: 'twilio', provider_session_id: callSid, caller_phone: from, status: 'active' }, { onConflict: 'provider,provider_session_id' })
    if (error) return new Response('Could not start receptionist session', { status: 502 })

    const legalDisclosurePrompt = 'Thanks for calling Roof OS. Please note this call is recorded for quality assurance. I am an automated AI assistant. How can I help you today?'
    return twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, legalDisclosurePrompt))
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid Twilio request', { status: 403 })
  }
}
