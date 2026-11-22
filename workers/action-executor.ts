import type { SupabaseClient } from '@supabase/supabase-js'
import { principalsInWorkspace } from '../lib/api-contract-safety'
import { approvedBatchRejection, isStaleExecuting, statusWriteSucceeded } from '../lib/agent-action-recovery'
import { needsApprovalTokenHash } from '../lib/action-batch-binding'

export type ExecutorResult = { batchId: string; executed: number; failed: number; skipped: number; failures: string[] }
type ActionRow = {
  id: string
  batch_id: string
  workspace_id: string
  kind: string
  subject_type: string
  subject_id: string | null
  payload: Record<string, unknown>
  status: string
  requires_approval: boolean
  payload_hash: string
  idempotency_key: string
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function stringValue(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`)
  return value.trim()
}

function nullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** A batch claimed by a crashed worker has no owner. Replay is safe because
 * task writes are keyed by `automation_key`; only a bounded, genuinely stale
 * claim is reset, and the status guard makes concurrent resets idempotent. */
export const EXECUTING_STALE_AFTER_MS = 15 * 60 * 1000

export async function requeueStaleExecutingBatches(
  supabase: SupabaseClient,
  nowMs: number = Date.now()
): Promise<number> {
  const { data, error } = await supabase
    .from('agent_action_batches')
    .select('id,execution_started_at')
    .eq('status', 'executing')
    .order('execution_started_at', { ascending: true })
    .limit(100)
  if (error) throw error
  let requeued = 0
  for (const batch of data ?? []) {
    const observedLease = batch.execution_started_at ?? null
    if (!isStaleExecuting(observedLease, nowMs, EXECUTING_STALE_AFTER_MS)) continue
    // Optimistic concurrency: only reset the claim we actually observed. If a
    // live worker renewed its lease between our SELECT and UPDATE, the predicate
    // matches zero rows and we leave the running batch alone.
    let guard = supabase
      .from('agent_action_batches')
      .update({ status: 'approved', execution_started_at: null, execution_finished_at: null })
      .eq('id', batch.id)
      .eq('status', 'executing')
    guard = observedLease === null
      ? guard.is('execution_started_at', null)
      : guard.eq('execution_started_at', observedLease)
    const { data: updated, error: updateError } = await guard.select('id')
    if (updateError) throw updateError
    if (updated && updated.length > 0) requeued += 1
  }
  return requeued
}

/** Renew the claim on every action so the reaper's stale window measures time
 * since last progress, not since the batch was first claimed. The lease value is
 * an ownership token: the update only lands if the row still carries the token
 * this worker expects. A re-claim by another worker changes it, so we fail closed
 * rather than race a requeued execution. Returns the new token to thread forward. */
async function touchBatchLease(
  supabase: SupabaseClient,
  batchId: string,
  expectedLeaseAt: string
): Promise<string> {
  const nextLeaseAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('agent_action_batches')
    .update({ execution_started_at: nextLeaseAt })
    .eq('id', batchId)
    .eq('status', 'executing')
    .eq('execution_started_at', expectedLeaseAt)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Action batch lease was lost during execution')
  return nextLeaseAt
}

/** Move a poisoned approved batch to a terminal status BEFORE throwing. Without
 * this the cron's `status = approved` select re-picks the same row forever and
 * starves every legitimate approval behind the 25-row limit. */
async function rejectApprovedBatch(supabase: SupabaseClient, batchId: string, reason: string): Promise<never> {
  const rejection = approvedBatchRejection(reason)
  const { error } = await supabase
    .from('agent_action_batches')
    .update({ status: rejection.status, execution_finished_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('status', 'approved')
  if (error) throw new Error(`${rejection.message} (terminal transition also failed: ${error.message})`)
  throw new Error(rejection.message)
}

async function executeAction(supabase: SupabaseClient, action: ActionRow) {
  // Membership is re-checked at execution time: approval can happen long after
  // an offboarding, and any writer of an approved action row is untrusted.
  const { data: memberRows, error: memberError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', action.workspace_id)
  if (memberError) throw memberError
  const memberIds = new Set(
    (memberRows ?? []).map((row) => row.user_id).filter((id): id is string => typeof id === 'string')
  )

  if (action.kind === 'create_task' || action.kind === 'create_review_task') {
    const createdBy = stringValue(action.payload, 'createdByUserId')
    const assignedTo = nullableString(action.payload, 'assignedToUserId') ?? createdBy
    const principals = principalsInWorkspace([createdBy, assignedTo], memberIds)
    if (!principals.ok) throw new Error(`Action principals are no longer members of this workspace: ${principals.missing.join(', ')}`)
    const title = stringValue(action.payload, 'title')
    const notes = nullableString(action.payload, 'notes')
    const dueAt = nullableString(action.payload, 'dueAt')
    const leadId = nullableString(action.payload, 'leadId')
    const taskPayload = {
      workspace_id: action.workspace_id,
      lead_id: leadId,
      title,
      due_at: dueAt,
      assigned_to: assignedTo,
      created_by: createdBy,
      status: 'open',
      notes,
      automation_key: `agent-action:${action.id}`,
    }
    const { data, error } = await supabase.from('tasks').insert(taskPayload).select('id,title,status').single()
    if (error?.code === '23505') {
      const existing = await supabase.from('tasks').select('id,title,status').eq('workspace_id', action.workspace_id).eq('automation_key', `agent-action:${action.id}`).maybeSingle()
      if (existing.error || !existing.data) throw existing.error ?? new Error('Existing task could not be loaded')
      return { kind: action.kind, task: existing.data, idempotentReplay: true }
    }
    if (error) throw error
    return { kind: action.kind, task: data }
  }

  if (action.kind === 'assign_owner') {
    if (action.subject_type !== 'lead' || !action.subject_id) throw new Error('assign_owner requires a lead subject')
    const ownerId = stringValue(action.payload, 'ownerId')
    const principals = principalsInWorkspace([ownerId], memberIds)
    if (!principals.ok) throw new Error(`The assigned owner is no longer a member of this workspace: ${principals.missing.join(', ')}`)
    const { data, error } = await supabase.from('leads').update({ owner_id: ownerId, updated_at: new Date().toISOString() }).eq('id', action.subject_id).eq('workspace_id', action.workspace_id).select('id,owner_id').single()
    if (error) throw error
    return { kind: action.kind, lead: data }
  }

  throw new Error(`No safe executor is registered for action kind ${action.kind}`)
}

export async function executeApprovedBatch(supabase: SupabaseClient, batchId: string): Promise<ExecutorResult> {
  const { data: batch, error: batchError } = await supabase.from('agent_action_batches').select('id,workspace_id,status,summary,approval_token_hash,expires_at').eq('id', batchId).maybeSingle()
  if (batchError) throw batchError
  if (!batch) throw new Error('Action batch not found')
  if (batch.status !== 'approved') throw new Error(`Action batch is not executable from status ${batch.status}`)
  if (batch.expires_at && new Date(batch.expires_at).getTime() <= Date.now()) {
    return await rejectApprovedBatch(supabase, batchId, 'expired')
  }

  const { data: actions, error: actionError } = await supabase.from('agent_actions').select('id,batch_id,workspace_id,kind,subject_type,subject_id,payload,status,requires_approval,payload_hash,idempotency_key').eq('batch_id', batchId).order('sequence', { ascending: true })
  if (actionError) throw actionError
  const rows = (actions ?? []) as ActionRow[]
  const result: ExecutorResult = { batchId, executed: 0, failed: 0, skipped: 0, failures: [] }
  for (const action of rows) {
    if (action.payload_hash !== await sha256(action.payload)) {
      return await rejectApprovedBatch(supabase, batchId, 'payload_hash_mismatch')
    }
  }
  // Only approval-required actions carry a signed approval token. A batch made
  // entirely of low-risk actions is legitimately inserted with a NULL hash and
  // must still execute — otherwise every auto-approved batch is terminalized
  // as a binding mismatch and no low-risk action ever runs.
  if (batch.status === 'approved' && needsApprovalTokenHash(rows)) {
    const currentPayloadHash = await sha256Text(rows.map((action) => `${action.id}:${action.payload_hash}`).join('\n'))
    if (!batch.approval_token_hash || currentPayloadHash !== batch.approval_token_hash) {
      return await rejectApprovedBatch(supabase, batchId, 'binding_mismatch')
    }
  }
  const { data: claimedBatch, error: claimError } = await supabase.from('agent_action_batches').update({ status: 'executing', execution_started_at: new Date().toISOString() }).eq('id', batchId).eq('status', 'approved').select('id,execution_started_at').maybeSingle()
  if (claimError) throw claimError
  if (!claimedBatch) return result
  let expectedLeaseAt = claimedBatch.execution_started_at
  if (typeof expectedLeaseAt !== 'string') throw new Error('Claimed batch has no lease token')

  for (const action of rows) {
    if (action.status === 'executed') { result.skipped += 1; continue }
    expectedLeaseAt = await touchBatchLease(supabase, batchId, expectedLeaseAt)
    if (action.requires_approval && action.status !== 'approved') {
      result.failed += 1
      const write = statusWriteSucceeded(await supabase
        .from('agent_actions')
        .update({ status: 'failed', error_message: 'Approved batch contained an action without approved status.' }).eq('id', action.id)
        .select('id'), true)
      if (!write.ok) result.failures.push(`Action ${action.id} ledger write failed: ${write.reason}`)
      continue
    }
    try {
      const output = await executeAction(supabase, action)
      const write = statusWriteSucceeded(await supabase
        .from('agent_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString(), result: output, error_message: null }).eq('id', action.id).in('status', ['approved', 'proposed'])
        .select('id'), true)
      if (write.ok) result.executed += 1
      else {
        result.failed += 1
        result.failures.push(`Action ${action.id} executed but its ledger write failed: ${write.reason}`)
      }
    } catch (error) {
      result.failed += 1
      const write = statusWriteSucceeded(await supabase
        .from('agent_actions')
        .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown action execution failure' }).eq('id', action.id).in('status', ['approved', 'proposed'])
        .select('id'), true)
      if (!write.ok) result.failures.push(`Action ${action.id} failure ledger write failed: ${write.reason}`)
    }
  }

  const finalStatus = result.failed > 0 ? 'failed' : 'executed'
  const finalWrite = statusWriteSucceeded(await supabase
    .from('agent_action_batches')
    .update({ status: finalStatus, execution_finished_at: new Date().toISOString() }).eq('id', batchId).eq('status', 'executing')
    .eq('execution_started_at', expectedLeaseAt)
    .select('id'), true)
  if (!finalWrite.ok) result.failures.push(`Batch ${batchId} final status write failed: ${finalWrite.reason}`)
  return result
}
