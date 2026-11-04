import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
import { idleEnabledWorkspaces } from '../../../../lib/agents/agent-enablement'
import { defaultWorkspaceSettings, loadWorkspaceSettings } from '../../../../lib/workspace-settings'
import { isWithinQuietHours, normalizeStrictE164 } from '../../../../lib/outbound-policy'

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()
  const publicUrl = process.env.RECEPTIONIST_PUBLIC_URL?.trim()
  if (!accountSid || !authToken || !from || !publicUrl) return null
  return { accountSid, authToken, from, publicUrl }
}

export const POST = createCronAgentRoute({
  agentKey: 'scheduler',
  workerVersion: 'scheduler-cron-v1',
  // The Twilio follow-up job keeps its original contract: no separate Supabase 503 check.
  requireSupabaseWorker: false,
  checkConfig: () => twilioConfig()
    ? null
    : NextResponse.json({ error: 'Twilio and receptionist configuration is incomplete.' }, { status: 503 }),
}, async ({ admin, heartbeat }) => {
  const { accountSid, authToken, from, publicUrl } = twilioConfig()!
  const batch = readCronBatchConfig('scheduler')
  // Scan past the per-run limit so queued attempts in workspaces with the receptionist
  // disabled cannot fill the batch and block enabled workspaces.
  const { data: queued, error } = await admin.from('receptionist_call_attempts').select('id,workspace_id,lead_id,phone,attempt_number').eq('direction', 'outbound').eq('status', 'queued').not('next_attempt_at', 'is', null).lte('next_attempt_at', new Date().toISOString()).order('created_at', { ascending: batch.ascending }).limit(batch.scanLimit)
  if (error) return NextResponse.json({ error: 'Could not read follow-up queue.', detail: error.message }, { status: 502 })
  const settingsByWorkspace = new Map<string, Awaited<ReturnType<typeof loadWorkspaceSettings>>>()
  for (const workspaceId of [...new Set((queued ?? []).map((attempt) => attempt.workspace_id as string))]) {
    settingsByWorkspace.set(workspaceId, await loadWorkspaceSettings(admin, workspaceId))
  }
  const receptionistEnabled = (workspaceId: string) => (settingsByWorkspace.get(workspaceId) ?? defaultWorkspaceSettings()).enable_ai_receptionist
  const disabledAttempts = (queued ?? []).filter((attempt) => !receptionistEnabled(attempt.workspace_id)).length
  const attempts = (queued ?? []).filter((attempt) => receptionistEnabled(attempt.workspace_id)).slice(0, batch.limit)
  // Heartbeats only for workspaces where the receptionist is enabled and has queued work.
  const workspaceIds = attempts.map((attempt) => attempt.workspace_id)
  await heartbeat(workspaceIds, 'starting')
  const client = twilio(accountSid, authToken)
  let started = 0
  let failed = 0
  let optedOut = 0
  let skipped = disabledAttempts
  const failures: Array<{ attemptId: string; error: string }> = []

  for (const attempt of attempts || []) {
    const settings = settingsByWorkspace.get(attempt.workspace_id) ?? defaultWorkspaceSettings()
    if (!settings.enable_ai_receptionist) { skipped += 1; continue }
    if (settings.enforce_tcpa_quiet_hours_outbound && !isWithinQuietHours()) { skipped += 1; continue }
    const phone = settings.require_strict_e164_phone_format ? normalizeStrictE164(attempt.phone) : attempt.phone
    if (!phone) {
      const invalidPhoneMessage = 'Follow-up skipped: phone number is not valid +1 E.164.'
      const { data: invalidClaim, error: invalidClaimError } = await admin
        .from('receptionist_call_attempts')
        .update({ status: 'failed' })
        .eq('id', attempt.id)
        .eq('status', 'queued')
        .select('id')
        .maybeSingle()
      if (invalidClaimError) {
        failed += 1
        failures.push({ attemptId: attempt.id, error: `${invalidPhoneMessage} Could not mark the queued attempt failed: ${invalidClaimError.message}` })
        continue
      }
      if (!invalidClaim) continue
      const { error: eventError } = await admin.from('receptionist_events').upsert({
        workspace_id: attempt.workspace_id,
        event_key: `followup:${attempt.id}:invalid_phone`,
        event_type: 'follow_up.invalid_phone',
        provider: 'twilio',
        payload: { attemptId: attempt.id, reason: 'invalid_e164_phone' },
      }, { onConflict: 'workspace_id,event_key' })
      failed += 1
      failures.push({
        attemptId: attempt.id,
        error: eventError ? `${invalidPhoneMessage} Event logging failed: ${eventError.message}` : invalidPhoneMessage,
      })
      continue
    }
    const { data: claimed } = await admin.from('receptionist_call_attempts').update({ status: 'ringing' }).eq('id', attempt.id).eq('status', 'queued').select('id').maybeSingle()
    if (!claimed) continue
    const { data: optOut } = await admin.from('receptionist_consents').select('id').eq('workspace_id', attempt.workspace_id).eq('phone', phone).eq('channel', 'voice').eq('state', 'revoked').order('captured_at', { ascending: false }).limit(1).maybeSingle()
    if (optOut) {
      await admin.from('receptionist_call_attempts').update({ status: 'opted_out' }).eq('id', attempt.id)
      optedOut += 1
      continue
    }
    try {
      const call = await client.calls.create({ to: phone, from, url: `${publicUrl}/api/receptionist/twilio/outbound/twiml?message=${encodeURIComponent('This is a follow-up from Roof OS. Please tell me how I can help.')}`, statusCallback: `${publicUrl}/api/receptionist/twilio/status`, statusCallbackMethod: 'POST' })
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

  // Enabled workspaces with no pending work still report in, so a quiet agent can be told
  // apart from an idle one (see lib/agents/agent-alerts.ts). Disabled workspaces get nothing.
  await heartbeat(await idleEnabledWorkspaces(admin, 'scheduler', workspaceIds), 'healthy', { idle: true })

  if (failed > 0) {
    await heartbeat(workspaceIds, 'degraded', { lastError: failures[0]?.error })
    return NextResponse.json({ processed: attempts?.length || 0, started, optedOut, failed, failures }, { status: 502 })
  }

  await heartbeat(workspaceIds, 'healthy')
  return NextResponse.json({ processed: attempts?.length || 0, started, optedOut, skipped, failed: 0 })
})

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
