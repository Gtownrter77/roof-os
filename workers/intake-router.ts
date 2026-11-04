
type LeadRecord = {
  id: string
  name: string
  address: string
  phone?: string | null
  email?: string | null
  owner_id?: string | null
}

export type IntakeLead = {
  id: string
  name: string
  address: string
  phone?: string | null
  email?: string | null
  ownerId?: string | null
}

export type IntakeRouterInput = {
  lead: IntakeLead
  existingLeads: IntakeLead[]
  roundRobinOwnerIds: string[]
  taskCreatorId: string
  now?: string | Date
}

export type IntakeRouterPlan = {
  normalized: { phone: string | null; email: string | null; address: string }
  duplicateLeadIds: string[]
  suggestedOwnerId: string | null
  firstResponseDueAt: string
  actions: Array<{
    kind: 'create_review_task' | 'create_task' | 'assign_owner'
    subjectType: 'lead'
    subjectId: string
    payload: Record<string, unknown>
    reason: string
    sourceEvidence: Array<Record<string, unknown>>
    idempotencyKey: string
  }>
}

type IntakeRouterConfig = {
  supabaseUrl: string
  serviceRoleKey: string
  workerId: string
  workerVersion: string
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized && normalized.includes('@') ? normalized : null
}

export function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function asDate(value: string | Date | undefined): Date {
  const date = value instanceof Date ? value : new Date(value ?? Date.now())
  if (!Number.isFinite(date.getTime())) throw new Error('now must be a valid date')
  return date
}

export function planIntakeRouter(input: IntakeRouterInput): IntakeRouterPlan {
  const normalized = {
    phone: normalizePhone(input.lead.phone),
    email: normalizeEmail(input.lead.email),
    address: normalizeAddress(input.lead.address),
  }
  const duplicateLeadIds = input.existingLeads
    .filter((candidate) => candidate.id !== input.lead.id)
    .filter((candidate) => {
      const sameEmail = Boolean(normalized.email && normalizeEmail(candidate.email) === normalized.email)
      const samePhone = Boolean(normalized.phone && normalizePhone(candidate.phone) === normalized.phone)
      const sameAddress = Boolean(normalized.address && normalizeAddress(candidate.address) === normalized.address)
      return sameEmail || samePhone || sameAddress
    })
    .map((candidate) => candidate.id)

  const suggestedOwnerId = input.lead.ownerId ?? (
    input.roundRobinOwnerIds.length
      ? input.roundRobinOwnerIds[simpleHash(input.lead.id) % input.roundRobinOwnerIds.length]
      : null
  )
  const firstResponseDueAt = new Date(asDate(input.now).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const evidence = [{
    leadId: input.lead.id,
    duplicateLeadIds,
    normalized,
  }]

  if (duplicateLeadIds.length > 0) {
    return {
      normalized,
      duplicateLeadIds,
      suggestedOwnerId,
      firstResponseDueAt,
      actions: [{
        kind: 'create_review_task',
        subjectType: 'lead',
        subjectId: input.lead.id,
        payload: {
          createdByUserId: input.taskCreatorId,
          assignedToUserId: input.taskCreatorId,
          leadId: input.lead.id,
          title: `Review possible duplicate lead: ${input.lead.name}`,
          notes: `Potential duplicate lead records: ${duplicateLeadIds.join(', ')}. Verify before contacting the customer.`,
        },
        reason: 'Deterministic contact or address match requires human review before routing.',
        sourceEvidence: evidence,
        idempotencyKey: `intake-review:${input.lead.id}`,
      }],
    }
  }

  const actions: IntakeRouterPlan['actions'] = []
  if (suggestedOwnerId && suggestedOwnerId !== input.lead.ownerId) {
    actions.push({
      kind: 'assign_owner',
      subjectType: 'lead',
      subjectId: input.lead.id,
      payload: { ownerId: suggestedOwnerId },
      reason: 'Assign an unowned lead via deterministic round-robin (hash of lead id).',
      sourceEvidence: evidence,
      idempotencyKey: `intake-owner:${input.lead.id}:${suggestedOwnerId}`,
    })
  }
  actions.push({
    kind: 'create_task',
    subjectType: 'lead',
    subjectId: input.lead.id,
    payload: {
      createdByUserId: input.taskCreatorId,
      assignedToUserId: suggestedOwnerId ?? input.taskCreatorId,
      leadId: input.lead.id,
      title: `First response: ${input.lead.name}`,
      dueAt: firstResponseDueAt,
      notes: 'Created by the Intake Router. Confirm contact details before outreach.',
    },
    reason: 'Every new lead receives a bounded first-response task.',
    sourceEvidence: evidence,
    idempotencyKey: `intake-first-response:${input.lead.id}`,
  })
  return { normalized, duplicateLeadIds, suggestedOwnerId, firstResponseDueAt, actions }
}

export async function runIntakeRouter(
  config: IntakeRouterConfig,
  workspaceId: string,
  leadId: string,
  taskCreatorId: string,
  eventKey: string,
) {
  const { createClient } = await import('@supabase/supabase-js')
  const { createAgentRuntime } = await import('./agent-runtime')
  const { persistActionBatch } = await import('./action-batch')
  const runtime = createAgentRuntime({ ...config, reviewTaskCreatorId: taskCreatorId })
  await runtime.heartbeat(workspaceId, 'intake_router', 'healthy', {
    deterministic: true,
    model_assistance: 'optional',
    checks: ['contact_normalization', 'duplicate_detection', 'owner_suggestion', 'first_response_task'],
  })

  return runtime.run({
    workspaceId,
    agentKey: 'intake_router',
    eventKey,
    trigger: 'lead_intake',
    inputReference: { lead_id: leadId },
  }, async () => {
    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id,name,address,phone,email,owner_id')
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (leadError) throw leadError
    if (!lead) throw new Error('Lead was not found in the requested workspace.')

    const { data: existing, error: existingError } = await supabase
      .from('leads')
      .select('id,name,address,phone,email,owner_id')
      .eq('workspace_id', workspaceId)
      .neq('id', leadId)
      .limit(200)
    if (existingError) throw existingError

    const { data: members, error: memberError } = await supabase
      .from('workspace_members')
      .select('user_id,role')
      .eq('workspace_id', workspaceId)
      .in('role', ['owner', 'admin', 'member'])
      .order('created_at', { ascending: true })
      .limit(100)
    if (memberError) throw memberError

    const plan = planIntakeRouter({
      lead: toLead(lead as LeadRecord),
      existingLeads: (existing ?? []).map((row) => toLead(row as LeadRecord)),
      roundRobinOwnerIds: (members ?? []).map((member) => member.user_id).filter(Boolean),
      taskCreatorId,
    })
    const batchKey = `intake:${leadId}:${eventKey}`
    const { data: existingBatch, error: existingBatchError } = await supabase
      .from('agent_action_batches')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('batch_key', batchKey)
      .maybeSingle()
    if (existingBatchError) throw existingBatchError
    const actionBatch = existingBatch
      ? { batch: existingBatch }
      : await persistActionBatch(supabase, {
          workspaceId,
          batchKey,
          summary: plan.duplicateLeadIds.length ? `Review duplicate lead routing for ${lead.name}` : `Route new lead ${lead.name}`,
          actions: plan.actions,
        })

    // Explicit execution boundary: non-review actions are executed immediately.
    if (plan.duplicateLeadIds.length === 0 && actionBatch.batch?.id) {
      const { executeApprovedBatch } = await import('./action-executor')
      // Mark batch approved so the existing executor can run non-approval actions.
      await supabase.from('agent_action_batches').update({ status: 'approved', approval_token_hash: 'auto' }).eq('id', actionBatch.batch.id).eq('status', 'proposed')
      await executeApprovedBatch(supabase, actionBatch.batch.id).catch(() => null)
    }

    return {
      status: plan.duplicateLeadIds.length ? ('needs_review' as const) : ('succeeded' as const),
      output: { ...plan, action_batch_id: actionBatch.batch.id },
      approvalState: plan.duplicateLeadIds.length ? ('pending' as const) : ('not_required' as const),
    }
  })
}

function simpleHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return hash
}

function toLead(row: LeadRecord): IntakeLead {
  return { id: row.id, name: row.name, address: row.address, phone: row.phone, email: row.email, ownerId: row.owner_id }
}
