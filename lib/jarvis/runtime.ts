// Concrete policy wiring for the single JARVIS worker. Every handler runs
// here: capabilities are scoped to a real agent, stop controls and plan-only
// are checked against database state, and every send passes canSendNow().
// Without a configured provider the runtime fails honestly; it never claims a
// delivery or a document that did not happen.

import type { AgentKey } from '../../workers/agent-registry.ts'
import { runSandboxAction } from '../adjuster/sandbox.ts'
import { canSendNow } from './guards.ts'
import { applyTransition, canAgentRun } from './orchestrator.ts'
import { prepareNote } from './journal/index.ts'
import type { Channel, ClaimStatus, ConsentRecord, JarvisJob, JarvisJobType } from './types.ts'
import { processJob } from '../../workers/jarvis-worker.ts'

export type RuntimePolicy = {
  claimId: string
  workspaceId: string
  status: ClaimStatus
  disabled: boolean
  planOnly: boolean
  authorized: boolean
  adjusterEnabled: boolean
  channel: Channel
  contact: string
  timeZone: string
  consent: ConsentRecord
  leadId: string
  identityId: string
}

export type RuntimeDeps = {
  loadPolicy: (job: JarvisJob) => Promise<RuntimePolicy | null>
  send: (policy: RuntimePolicy, job: JarvisJob) => Promise<string>
  recordNote: (note: ReturnType<typeof prepareNote>) => Promise<void>
  writeStatus: (claimId: string, status: ClaimStatus) => Promise<void>
  documents: { generate: (job: JarvisJob) => Promise<unknown> }
  extraction: { extract: (job: JarvisJob) => Promise<unknown> }
  sandboxPerform: (payload: Record<string, unknown>) => Promise<unknown>
  now?: Date
}

const DEFAULT_AGENT: Record<JarvisJobType, AgentKey> = {
  run_claim_plan: 'intake_router',
  update_claim_status: 'scheduler',
  send_message: 'scheduler',
  generate_document: 'office_copilot',
  extract_estimate: 'inspection_quality',
  sandbox_action: 'intake_router',
}

const EVENT_FOR: Partial<Record<JarvisJobType, string>> = {
  run_claim_plan: 'plan_created',
  send_message: 'contacted',
  extract_estimate: 'estimate_extracted',
}

/** Jobs that touch a real claim or produce a real artifact. */
const EXECUTION_JOB_TYPES = new Set<JarvisJobType>([
  'send_message', 'generate_document', 'extract_estimate',
])

/**
 * Dispatched handlers exist for all six job types, but these two providers are
 * not part of this deployment. They fail explicitly instead of pretending to
 * have produced a document or an estimate. Enqueue policy only creates
 * `run_claim_plan` today.
 */
const UNCONFIGURED_JOB_TYPES = new Set<JarvisJobType>([
  'generate_document', 'extract_estimate',
])

export function adjusterError(reason: string): Error & { code: string } {
  return Object.assign(new Error(`Adjuster job rejected: ${reason}`), { code: 'adjuster_error' })
}

export function agentForJob(job: JarvisJob): AgentKey {
  const requested = job.payload?.agentKey
  if (typeof requested === 'string' && requested) return requested as AgentKey
  return DEFAULT_AGENT[job.type]
}

export function eventForJob(job: JarvisJob): string | null {
  if (job.type === 'update_claim_status' && typeof job.payload?.event === 'string') return job.payload.event
  return EVENT_FOR[job.type] ?? null
}

function deliveryState(value: string): string {
  return value === 'delivered' ? 'delivered' : 'unknown'
}

/** Run one job through the real guard/compliance chain. */
export async function runJobWithPolicies(job: JarvisJob, deps: RuntimeDeps): Promise<unknown> {
  const policy = await deps.loadPolicy(job)
  if (!policy) throw adjusterError('claim not found in workspace')
  if (policy.disabled || !policy.adjusterEnabled) throw adjusterError('adjuster stopped')
  if (!canAgentRun(agentForJob(job), job.type)) throw adjusterError('agent capability not granted')
  if (EXECUTION_JOB_TYPES.has(job.type) && policy.planOnly && !policy.authorized) {
    throw adjusterError('plan_only: execution requires explicit owner authorization')
  }
  if (UNCONFIGURED_JOB_TYPES.has(job.type)) {
    throw adjusterError(`${job.type} is not configured for this deployment`)
  }

  const now = deps.now ?? new Date()
  const context = {
    guards: {
      authorize: () => canSendNow({
        channel: policy.channel,
        contact: policy.contact,
        consent: policy.consent,
        now,
        timeZone: policy.timeZone,
      }),
    },
    gateway: {
      send: async () => {
        // HANDLERS.send_message calls authorize() first; a false decision throws
        // there, so this block runs only for a consented, in-window contact.
        const status = await deps.send(policy, job)
        if (deliveryState(status) !== 'delivered') throw adjusterError('delivery could not be confirmed')
        await deps.recordNote(prepareNote({
          workspaceId: policy.workspaceId,
          claimId: policy.claimId,
          leadId: policy.leadId,
          identityId: policy.identityId,
          channel: policy.channel,
          direction: 'outbound',
          body: typeof job.payload?.body === 'string' ? job.payload.body : '',
          createdAt: now.toISOString(),
          consentSnapshot: { channel: policy.channel, contact: policy.contact },
        }))
        return status
      },
    },
    orchestrator: {
      transition: async () => {
        const event = eventForJob(job)
        if (!event) return policy.status
        const result = applyTransition({
          status: policy.status,
          disabled: policy.disabled,
          planOnly: policy.planOnly,
          authorized: policy.authorized,
        }, event)
        if (!result.changed) throw adjusterError(result.reason ?? 'transition rejected')
        await deps.writeStatus(policy.claimId, result.claim.status)
        return result.claim.status
      },
    },
    documents: { generate: (current: JarvisJob) => deps.documents.generate(current) },
    extraction: { extract: (current: JarvisJob) => deps.extraction.extract(current) },
    sandbox: {
      run: async () => {
        try {
          const result = runSandboxAction(
            { kind: 'sandbox_action', url: typeof job.payload?.url === 'string' ? job.payload.url : undefined },
            { perform: () => deps.sandboxPerform(job.payload ?? {}) },
          )
          if (result.ok === false) throw adjusterError(result.errorNote.detail)
          // The provider call may be async; resolve it here so a rejected
          // promise is reported as an adjuster_error, never as a fake success.
          return await result.result
        } catch (cause) {
          if ((cause as { code?: string }).code === 'adjuster_error') throw cause
          throw adjusterError(cause instanceof Error ? cause.message : 'Sandbox action failed.')
        }
      },
    },
  }

  return processJob(job, context)
}
