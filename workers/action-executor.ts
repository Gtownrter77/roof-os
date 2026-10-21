import type { SupabaseClient } from '@supabase/supabase-js'

export type ExecutorResult = { batchId: string; executed: number; failed: number; skipped: number }
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

function stringValue(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`)
  return value.trim()
}

function nullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function executeAction(supabase: SupabaseClient, action: ActionRow) {
  if (action.kind === 'create_task' || action.kind === 'create_review_task') {
    const createdBy = stringValue(action.payload, 'createdByUserId')
    const assignedTo = nullableString(action.payload, 'assignedToUserId') ?? createdBy
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
    const { data, error } = await supabase.from('leads').update({ owner_id: ownerId, updated_at: new Date().toISOString() }).eq('id', action.subject_id).eq('workspace_id', action.workspace_id).select('id,owner_id').single()
    if (error) throw error
    return { kind: action.kind, lead: data }
  }

  throw new Error(`No safe executor is registered for action kind ${action.kind}`)
}

export async function executeApprovedBatch(supabase: SupabaseClient, batchId: string): Promise<ExecutorResult> {
  const { data: batch, error: batchError } = await supabase.from('agent_action_batches').select('id,workspace_id,status,expires_at').eq('id', batchId).maybeSingle()
  if (batchError) throw batchError
  if (!batch) throw new Error('Action batch not found')
  if (batch.status !== 'approved') throw new Error(`Action batch is not executable from status ${batch.status}`)
  if (batch.expires_at && new Date(batch.expires_at).getTime() <= Date.now()) throw new Error('Action batch has expired')

  const { data: actions, error: actionError } = await supabase.from('agent_actions').select('id,batch_id,workspace_id,kind,subject_type,subject_id,payload,status,requires_approval,payload_hash,idempotency_key').eq('batch_id', batchId).order('sequence', { ascending: true })
  if (actionError) throw actionError
  const rows = (actions ?? []) as ActionRow[]
  const result: ExecutorResult = { batchId, executed: 0, failed: 0, skipped: 0 }
  const { data: claimedBatch, error: claimError } = await supabase.from('agent_action_batches').update({ status: 'executing', execution_started_at: new Date().toISOString() }).eq('id', batchId).eq('status', 'approved').select('id').maybeSingle()
  if (claimError) throw claimError
  if (!claimedBatch) return { batchId, executed: 0, failed: 0, skipped: rows.length }

  for (const action of rows) {
    if (action.status === 'executed') { result.skipped += 1; continue }
    if (action.requires_approval && action.status !== 'approved') {
      result.failed += 1
      await supabase.from('agent_actions').update({ status: 'failed', error_message: 'Approved batch contained an action without approved status.' }).eq('id', action.id)
      continue
    }
    try {
      const output = await executeAction(supabase, action)
      await supabase.from('agent_actions').update({ status: 'executed', executed_at: new Date().toISOString(), result: output, error_message: null }).eq('id', action.id).in('status', ['approved', 'proposed'])
      result.executed += 1
    } catch (error) {
      result.failed += 1
      await supabase.from('agent_actions').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown action execution failure' }).eq('id', action.id).in('status', ['approved', 'proposed'])
    }
  }

  const finalStatus = result.failed > 0 ? 'failed' : 'executed'
  await supabase.from('agent_action_batches').update({ status: finalStatus, execution_finished_at: new Date().toISOString() }).eq('id', batchId).eq('status', 'executing')
  return result
}
