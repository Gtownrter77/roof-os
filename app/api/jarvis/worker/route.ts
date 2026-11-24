import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchWithTimeout, isUuid } from '../../../../lib/api-security'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { canSendNow, isQuietHours } from '../../../../lib/jarvis/guards'
import { isAllowlisted } from '../../../../lib/adjuster/sandbox'
import { isAuthorizedWorkerAuthHeader } from '../../../../lib/jarvis/api/auth'
import { resolveConsent, type ConsentRow } from '../../../../lib/jarvis/api/consent'
import { mapJobRow } from '../../../../lib/jarvis/api/row'
import { adjusterError, runJobWithPolicies, type RuntimeDeps, type RuntimePolicy } from '../../../../lib/jarvis/runtime'
import type { ClaimStatus, JarvisJob } from '../../../../lib/jarvis/types'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }
const LEASE_MS = 5 * 60 * 1000

function requireSecret(request: NextRequest): boolean {
  return isAuthorizedWorkerAuthHeader(request.headers.get('authorization'), {
    worker: process.env.JARVIS_ADJUSTER_WORKER_SECRET?.trim() ?? '',
    cron: process.env.CRON_SECRET?.trim() ?? '',
  })
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
  const workerId = `jarvis-worker:${randomUUID()}`

  // Recover jobs abandoned by a crashed worker; an old claimant can no longer
  // finish a job that another lease holder has since picked up.
  const staleBefore = new Date(Date.now() - LEASE_MS).toISOString()
  const { error: staleError } = await supabase
    .from('jarvis_jobs')
    .update({ status: 'queued', locked_by: null, locked_at: null })
    .eq('status', 'running')
    .lt('locked_at', staleBefore)
  if (staleError) return NextResponse.json({ error: 'Stale job leases could not be recovered.' }, { status: 502, headers: NO_STORE })

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

  // PostgREST rows are snake_case; the runtime contract is camelCase.
  let job: JarvisJob
  try {
    job = mapJobRow(queued as Record<string, unknown>)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'Invalid job row.'
    await supabase.from('jarvis_jobs').update({ status: 'failed', last_error: reason }).eq('id', (queued as { id?: string }).id)
    return NextResponse.json({ error: reason }, { status: 502, headers: NO_STORE })
  }

  const { data: claimed, error: lockError } = await supabase
    .from('jarvis_jobs')
    .update({
      status: 'running',
      locked_by: workerId,
      locked_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
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
    const contact = channel === 'email' ? lead?.email ?? '' : lead?.phone ?? ''
    const now = new Date()
    let consentRows: readonly ConsentRow[] = []
    if (claim.lead_id) {
      const { data, error } = await supabase
        .from('receptionist_consents')
        .select('channel,state,phone,captured_at,expires_at')
        .eq('workspace_id', current.workspaceId)
        .eq('lead_id', claim.lead_id)
        .limit(200)
      // Fail closed: a failed revocation lookup must never look like consent.
      if (error) throw adjusterError('consent status could not be verified')
      consentRows = (data ?? []) as readonly ConsentRow[]
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
      contact,
      timeZone: claim.time_zone || 'UTC',
      consent: resolveConsent(consentRows, channel, contact, now),
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
  const { data: finished, error: finishError } = await supabase
    .from('jarvis_jobs')
    .update({ status, last_error: lastError, updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('locked_by', workerId)
    .select('id')
    .maybeSingle()
  if (finishError || !finished) {
    return NextResponse.json({ error: 'Job outcome could not be recorded or the lease was lost.', jobId: job.id }, { status: 502, headers: NO_STORE })
  }
  if (unexpected) {
    return NextResponse.json({ error: lastError, jobId: job.id, status }, { status: 502, headers: NO_STORE })
  }

  // isQuietHours is re-checked in the guard chain; this label is informational.
  const quiet = isQuietHours(new Date(), 'UTC')
  return NextResponse.json({ processed: true, jobId: job.id, status, quietHoursUtc: quiet }, { headers: NO_STORE })
}
