import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchWithTimeout, isUuid } from '../../../../lib/api-security'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { canSendNow, isQuietHours } from '../../../../lib/jarvis/guards'
import { isAllowlisted } from '../../../../lib/adjuster/sandbox'
import { adjusterError, runJobWithPolicies, type RuntimeDeps, type RuntimePolicy } from '../../../../lib/jarvis/runtime'
import type { ClaimStatus, JarvisJob } from '../../../../lib/jarvis/types'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

function requireSecret(request: NextRequest): boolean {
  const secret = process.env.JARVIS_ADJUSTER_WORKER_SECRET?.trim() ?? process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function consentState(rows: Array<{ channel: string; state: string }>, channel: 'sms' | 'email' | 'voice') {
  return rows.some((row) => row.channel === channel && row.state === 'granted')
}

/** One job per request. All policy decisions come from DB state. */
export async function POST(request: NextRequest) {
  if (!requireSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE })
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503, headers: NO_STORE })
  const { url } = getSupabaseEnv()
  const supabase = createServiceClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: queued, error: claimError } = await supabase
    .from('jarvis_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('run_after', new Date().toISOString())
    .order('run_after', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (claimError) return NextResponse.json({ error: 'Queue could not be read.' }, { status: 502, headers: NO_STORE })
  if (!queued) return NextResponse.json({ processed: false }, { headers: NO_STORE })

  const job = queued as JarvisJob
  const { data: claimed, error: lockError } = await supabase
    .from('jarvis_jobs')
    .update({ status: 'running', locked_by: 'jarvis-worker', locked_at: new Date().toISOString(), attempts: job.attempts + 1 })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('id')
    .maybeSingle()
  if (lockError) return NextResponse.json({ error: 'Job could not be claimed.' }, { status: 502, headers: NO_STORE })
  if (!claimed) return NextResponse.json({ processed: false }, { headers: NO_STORE })

  const loadPolicy: RuntimeDeps['loadPolicy'] = async (current) => {
    if (!isUuid(current.claimId)) return null
    const { data: claim } = await supabase
      .from('adjuster_claims')
      .select('id,workspace_id,lead_id,status,disabled,time_zone')
      .eq('id', current.claimId)
      .eq('workspace_id', current.workspaceId)
      .maybeSingle()
    if (!claim) return null
    const { data: settings } = await supabase
      .from('workspace_adjuster_settings')
      .select('adjuster_enabled,plan_only,identity_id')
      .eq('workspace_id', current.workspaceId)
      .maybeSingle()
    const { data: lead } = claim.lead_id
      ? await supabase.from('leads').select('phone,email').eq('id', claim.lead_id).maybeSingle()
      : { data: null }

    const channel = current.payload?.channel === 'email' ? 'email' : 'sms'
    let consentRows: Array<{ channel: string; state: string }> = []
    if (claim.lead_id) {
      const { data } = await supabase
        .from('receptionist_consents')
        .select('channel,state')
        .eq('workspace_id', current.workspaceId)
        .eq('lead_id', claim.lead_id)
        .limit(100)
      consentRows = (data ?? []) as Array<{ channel: string; state: string }>
    }
    const policy: RuntimePolicy = {
      claimId: claim.id,
      workspaceId: current.workspaceId,
      status: claim.status as ClaimStatus,
      disabled: claim.disabled,
      planOnly: settings?.plan_only ?? true,
      // Explicit owner opt-in at deployment level; absent config stays PLAN ONLY.
      authorized: process.env.JARVIS_ADJUSTER_EXECUTION_AUTHORIZED === 'true',
      adjusterEnabled: settings?.adjuster_enabled ?? true,
      channel,
      contact: (channel === 'email' ? lead?.email ?? '' : lead?.phone ?? ''),
      timeZone: claim.time_zone || 'UTC',
      consent: {
        smsConsent: consentState(consentRows, 'sms'),
        emailConsent: consentState(consentRows, 'email'),
        voiceConsent: consentState(consentRows, 'voice'),
        optedOutAt: null,
      },
      leadId: claim.lead_id ?? '',
      identityId: settings?.identity_id ?? '',
    }
    return policy
  }

  const deps: RuntimeDeps = {
    loadPolicy,
    send: async (policy, current) => {
      const gatewayUrl = process.env.JARVIS_ADJUSTER_GATEWAY_URL?.trim()
      if (!gatewayUrl) throw adjusterError('no outbound gateway is configured')
      // The guard chain has already passed before this provider call.
      const allowed = canSendNow({
        channel: policy.channel,
        contact: policy.contact,
        consent: policy.consent,
        now: new Date(),
        timeZone: policy.timeZone,
      })
      if (!allowed) throw adjusterError('send blocked by consent or contact window')
      const response = await fetchWithTimeout(gatewayUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: policy.contact, channel: policy.channel, body: current.payload?.body ?? '' }),
      })
      const payload = await response.json().catch(() => ({})) as { status?: string }
      return response.ok && payload.status === 'delivered' ? 'delivered' : 'unknown'
    },
    recordNote: async (note) => {
      const { error } = await supabase.from('adjuster_messages').insert({
        workspace_id: note.workspaceId,
        claim_id: note.claimId,
        identity_id: note.identityId,
        lead_id: note.leadId,
        channel: note.channel,
        direction: note.direction,
        body: note.body,
        consent_snapshot: note.consentSnapshot ?? {},
        idempotency_key: note.idempotencyKey,
      })
      if (error) throw new Error(`adjuster message insert failed: ${error.message}`)
    },
    writeStatus: async (claimId, status) => {
      const { error } = await supabase.from('adjuster_claims').update({ status }).eq('id', claimId)
      if (error) throw new Error(`claim status write failed: ${error.message}`)
    },
    documents: { generate: async () => { throw adjusterError('document renderer is not configured') } },
    extraction: { extract: async () => { throw adjusterError('estimate extractor is not configured') } },
    sandboxPerform: async (payload) => {
      const allowlist = (process.env.JARVIS_ADJUSTER_SANDBOX_ALLOWLIST ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
      const target = typeof payload.url === 'string' ? payload.url : ''
      if (!isAllowlisted(target, allowlist)) throw adjusterError('sandbox target is not allowlisted')
      const response = await fetchWithTimeout(target)
      if (!response.ok) throw adjusterError('sandbox target returned an error')
      return { status: response.status }
    },
  }

  let status: 'succeeded' | 'failed' = 'succeeded'
  let lastError: string | null = null
  let unexpected = false
  try {
    await runJobWithPolicies(job, deps)
  } catch (cause) {
    status = 'failed'
    lastError = cause instanceof Error ? cause.message : 'Unknown adjuster job failure.'
    unexpected = (cause as { code?: string }).code !== 'adjuster_error'
  }
  const { error: finishError } = await supabase
    .from('jarvis_jobs')
    .update({ status, last_error: lastError, updated_at: new Date().toISOString() })
    .eq('id', job.id)
  if (finishError) {
    return NextResponse.json({ error: 'Job outcome could not be recorded.', jobId: job.id }, { status: 502, headers: NO_STORE })
  }
  if (unexpected) {
    return NextResponse.json({ error: lastError, jobId: job.id, status }, { status: 502, headers: NO_STORE })
  }

  // isQuietHours is re-checked in the guard chain; this label is informational.
  const quiet = isQuietHours(new Date(), 'UTC')
  return NextResponse.json({ processed: true, jobId: job.id, status, quietHoursUtc: quiet }, { headers: NO_STORE })
}
