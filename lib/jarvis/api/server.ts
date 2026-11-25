// Database adapter for the single JARVIS queue and the adjuster message thread.
// Kept thin: all decisions are made by the pure rules in ./index.ts. Every
// write uses a named RPC so RLS cannot silently reject an authenticated write
// and inbound writes are atomic instead of half-committed.

import { enqueueShape, payloadHash, foreignKeysForNote } from '../queue/index.ts'
import { messageIdempotencyKey } from '../queue/index.ts'
import { correlateInbound, correlateInboundToClaim, resolveInboundWorkspace } from './index.ts'

type SupabaseLike = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }
}

/** Enroll a verified lead through the RLS-safe enrollment RPC. */
export async function enrollClaim(
  supabase: SupabaseLike,
  input: { workspaceId: string; leadId: string; identityId?: string | null },
): Promise<unknown> {
  const identity = foreignKeysForNote({
    claimId: input.leadId,
    leadId: null,
    identityId: input.identityId,
  }).identityId
  const { data, error } = await supabase.rpc('adjuster_enroll_claim', {
    p_workspace_id: input.workspaceId,
    p_lead_id: input.leadId,
    p_identity_id: identity,
  })
  if (error) throw new Error(`adjuster_enroll_claim failed: ${String(error)}`)
  return data
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
 * Persist an inbound message and its plan job atomically, only after workspace
 * binding and sender-to-claim correlation both pass. Rejected messages make no
 * write of any kind.
 */
export async function writeInbound(
  supabase: SupabaseLike,
  config: { webhookWorkspaceId: string; identityId: string },
  payload: {
    claimId: string
    claimWorkspaceId?: string | null
    claimLeadId?: string | null
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
  }) || !correlateInboundToClaim(payload.claimLeadId, payload.matchedLead)) {
    return { ok: false, reason: 'unmatched_sender' }
  }

  const keys = foreignKeysForNote({
    claimId: payload.claimId,
    leadId: payload.matchedLead?.id ?? null,
    identityId: config.identityId,
  })
  const idempotencyKey = messageIdempotencyKey({
    workspaceId: config.webhookWorkspaceId,
    claimId: payload.claimId,
    channel: payload.from.includes('@') ? 'email' : 'sms',
    direction: 'inbound',
    body: payload.body,
  })

  const { data, error } = await supabase.rpc('adjuster_record_inbound', {
    p_workspace_id: config.webhookWorkspaceId,
    p_claim_id: payload.claimId,
    p_identity_id: keys.identityId,
    p_channel: payload.from.includes('@') ? 'email' : 'sms',
    p_contact: payload.from,
    p_body: payload.body,
    p_matched_lead_id: keys.leadId || null,
    p_payload_hash: payloadHash({ claimId: payload.claimId, source: 'inbound' }),
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw new Error(`adjuster_record_inbound failed: ${String(error)}`)
  return { ok: true, jobId: data }
}
