import type { SupabaseClient } from '@supabase/supabase-js'
import { validateBatch, type AgentActionBatch } from '../lib/agent-actions'

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
}

export async function sha256Hex(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(stableJson(value))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function persistActionBatch(
  supabase: SupabaseClient,
  input: AgentActionBatch & { agentRunId?: string; expiresAt?: string },
) {
  const checked = validateBatch(input)
  const batchPayload = {
    workspace_id: input.workspaceId,
    agent_run_id: input.agentRunId ?? null,
    batch_key: input.batchKey,
    status: checked.requiresApproval ? 'awaiting_approval' : 'approved',
    risk_level: checked.riskLevel,
    summary: input.summary,
    expires_at: input.expiresAt ?? null,
  }
  const { data: batch, error: batchError } = await supabase
    .from('agent_action_batches')
    .insert(batchPayload)
    .select('id,workspace_id,batch_key,status,risk_level,summary,expires_at,created_at')
    .single()
  if (batchError || !batch) throw batchError ?? new Error('Action batch was not created')

  const actions = []
  for (let index = 0; index < checked.actions.length; index += 1) {
    const action = checked.actions[index]
    actions.push({
      workspace_id: input.workspaceId,
      batch_id: batch.id,
      sequence: index + 1,
      kind: action.kind,
      subject_type: action.subjectType,
      subject_id: action.subjectId ?? null,
      payload: action.payload,
      reason: action.reason,
      source_evidence: action.sourceEvidence,
      risk_level: action.riskLevel,
      status: 'proposed',
      idempotency_key: action.idempotencyKey,
      requires_approval: action.requiresApproval,
      payload_hash: await sha256Hex(action.payload),
    })
  }
  const { data: insertedActions, error: actionError } = await supabase
    .from('agent_actions')
    .insert(actions)
    .select('id,batch_id,sequence,kind,status,risk_level,requires_approval,idempotency_key,payload_hash')
    .order('sequence', { ascending: true })
  if (actionError || !insertedActions) {
    await supabase.from('agent_action_batches').delete().eq('id', batch.id)
    throw actionError ?? new Error('Action batch actions were not created')
  }
  return { batch, actions: insertedActions, requiresApproval: checked.requiresApproval, riskLevel: checked.riskLevel }
}
