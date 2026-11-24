// Database adapter for the single JARVIS queue and the adjuster message thread.
// Kept thin: all decisions are made by the pure rules in ./index.ts.

import { enqueueShape } from '../queue/index.ts'
import { prepareNote } from '../journal/index.ts'
import { correlateInbound, resolveInboundWorkspace } from './index.ts'

type SupabaseLike = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }
}

/** Enqueue through the RPC with explicit payload_hash and idempotency_key. */
export async function enqueueJob(
  supabase: SupabaseLike,
  input: Parameters<typeof enqueueShape>[0],
): Promise<unknown> {
  const shape = enqueueShape(input)
  const { data, error } = await supabase.rpc('jarvis_enqueue_job', {
    p_workspace_id: shape.workspace_id,
    p_type: shape.type,
    p_payload: shape.payload,
    p_payload_hash: shape.payload_hash,
    p_idempotency_key: shape.idempotency_key,
    p_claim_id: shape.claim_id,
    p_lead_id: shape.lead_id,
    p_run_after: shape.run_after,
  })
  if (error) throw new Error(`jarvis_enqueue_job failed: ${String(error)}`)
  return data
}

/**
 * Persist an inbound message only after workspace binding and sender
 * correlation both pass. No insert occurs on a rejected message.
 */
export async function writeInbound(
  supabase: SupabaseLike,
  config: { webhookWorkspaceId: string; identityId: string },
  payload: {
    claimWorkspaceId?: string | null
    from: string
    body: string
    matchedLead: { id?: string; workspaceId: string; phone?: string | null; email?: string | null } | null
  },
): Promise<{ ok: true; jobId: unknown } | { ok: false; reason: string }> {
  const binding = resolveInboundWorkspace({
    claimWorkspaceId: payload.claimWorkspaceId,
    webhookWorkspaceId: config.webhookWorkspaceId,
  })
  if (!binding.allowed) return { ok: false, reason: binding.reason ?? 'workspace_mismatch' }

  if (!correlateInbound({
    from: payload.from,
    matchedLead: payload.matchedLead,
    workspaceId: config.webhookWorkspaceId,
  })) return { ok: false, reason: 'unmatched_sender' }

  const note = prepareNote({
    workspaceId: config.webhookWorkspaceId,
    claimId: payload.claimWorkspaceId!,
    leadId: payload.matchedLead?.id ?? null,
    identityId: config.identityId,
    channel: payload.from.includes('@') ? 'email' : 'sms',
    direction: 'inbound',
    body: payload.body,
  })

  const { error } = await supabase.from('adjuster_messages').insert({
    workspace_id: note.workspaceId,
    claim_id: note.claimId,
    identity_id: note.identityId,
    lead_id: note.leadId,
    channel: note.channel,
    direction: note.direction,
    body: note.body,
    consent_snapshot: { correlated: true },
    idempotency_key: note.idempotencyKey,
  })
  if (error) throw new Error(`adjuster_messages insert failed: ${String(error)}`)

  const jobId = await enqueueJob(supabase, {
    workspaceId: config.webhookWorkspaceId,
    type: 'run_claim_plan',
    payload: { claimId: note.claimId, source: 'inbound' },
    claimId: note.claimId,
    leadId: note.leadId || null,
  })
  return { ok: true, jobId }
}
