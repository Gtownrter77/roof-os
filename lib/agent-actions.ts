export type AgentRiskLevel =
  | 'none'
  | 'internal'
  | 'customer_communication'
  | 'operational'
  | 'financial'
  | 'legal'

export type AgentActionKind =
  | 'normalize_contact'
  | 'tag_record'
  | 'create_task'
  | 'create_review_task'
  | 'draft_message'
  | 'send_message'
  | 'propose_appointment'
  | 'book_appointment'
  | 'assign_owner'
  | 'assign_crew'
  | 'draft_estimate'
  | 'send_estimate'
  | 'draft_material_order'
  | 'submit_material_order'
  | 'issue_invoice'
  | 'create_payment_link'
  | 'request_signature'
  | 'delete_record'
  | 'change_permissions'

export type AgentActionStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'skipped'
  | 'failed'

export type AgentAction = {
  id?: string
  kind: AgentActionKind
  subjectType: string
  subjectId?: string
  payload: Record<string, unknown>
  reason: string
  sourceEvidence: Array<Record<string, unknown>>
  riskLevel?: AgentRiskLevel
  requiresApproval?: boolean
  idempotencyKey: string
  payloadHash?: string
  status?: AgentActionStatus
}

export type AgentActionBatch = {
  workspaceId: string
  batchKey: string
  summary: string
  actions: AgentAction[]
  expiresAt?: string
}

const RISK_BY_KIND: Record<AgentActionKind, AgentRiskLevel> = {
  normalize_contact: 'none',
  tag_record: 'internal',
  create_task: 'internal',
  create_review_task: 'internal',
  draft_message: 'customer_communication',
  send_message: 'customer_communication',
  propose_appointment: 'operational',
  book_appointment: 'operational',
  assign_owner: 'internal',
  assign_crew: 'operational',
  draft_estimate: 'operational',
  send_estimate: 'financial',
  draft_material_order: 'operational',
  submit_material_order: 'financial',
  issue_invoice: 'financial',
  create_payment_link: 'financial',
  request_signature: 'legal',
  delete_record: 'legal',
  change_permissions: 'legal',
}

const ALWAYS_APPROVAL: ReadonlySet<AgentActionKind> = new Set([
  'send_message',
  'book_appointment',
  'assign_crew',
  'send_estimate',
  'submit_material_order',
  'issue_invoice',
  'create_payment_link',
  'request_signature',
  'delete_record',
  'change_permissions',
])

export function classifyAction(kind: AgentActionKind): AgentRiskLevel {
  return RISK_BY_KIND[kind]
}

export function requiresHumanApproval(action: Pick<AgentAction, 'kind' | 'requiresApproval'>): boolean {
  return action.requiresApproval === true || ALWAYS_APPROVAL.has(action.kind)
}

export function normalizeAction(action: AgentAction): AgentAction {
  const riskLevel = action.riskLevel ?? classifyAction(action.kind)
  const requiresApproval = requiresHumanApproval({ kind: action.kind, requiresApproval: action.requiresApproval })
  if (riskLevel === 'none' && requiresApproval) {
    throw new Error(`Invalid approval policy: ${action.kind} cannot be both none-risk and approval-required`)
  }
  return {
    ...action,
    riskLevel,
    requiresApproval,
    sourceEvidence: Array.isArray(action.sourceEvidence) ? action.sourceEvidence : [],
    status: action.status ?? 'proposed',
  }
}

export function validateBatch(batch: AgentActionBatch): { actions: AgentAction[]; requiresApproval: boolean; riskLevel: AgentRiskLevel } {
  if (!batch.workspaceId.trim()) throw new Error('workspaceId is required')
  if (!batch.batchKey.trim()) throw new Error('batchKey is required')
  if (!batch.summary.trim()) throw new Error('summary is required')
  if (batch.actions.length === 0) throw new Error('at least one action is required')

  const normalized = batch.actions.map(normalizeAction)
  const idempotencyKeys = new Set<string>()
  for (const action of normalized) {
    if (!action.idempotencyKey.trim()) throw new Error(`idempotencyKey is required for ${action.kind}`)
    if (idempotencyKeys.has(action.idempotencyKey)) throw new Error(`duplicate idempotencyKey: ${action.idempotencyKey}`)
    idempotencyKeys.add(action.idempotencyKey)
    if (!action.reason.trim()) throw new Error(`reason is required for ${action.kind}`)
  }

  const riskLevel = normalized.reduce<AgentRiskLevel>((highest, action) => maxRisk(highest, action.riskLevel ?? 'internal'), 'none')
  return { actions: normalized, requiresApproval: normalized.some((action) => action.requiresApproval), riskLevel }
}

const RISK_ORDER: AgentRiskLevel[] = ['none', 'internal', 'customer_communication', 'operational', 'financial', 'legal']

function maxRisk(left: AgentRiskLevel, right: AgentRiskLevel): AgentRiskLevel {
  return RISK_ORDER.indexOf(left) >= RISK_ORDER.indexOf(right) ? left : right
}

export function canExecuteApprovedAction(action: Pick<AgentAction, 'status' | 'requiresApproval' | 'payloadHash'>, approvedPayloadHash?: string): boolean {
  if (!action.requiresApproval && action.status === 'proposed') return true
  if (action.status !== 'approved') return false
  if (action.requiresApproval && (!approvedPayloadHash || approvedPayloadHash !== action.payloadHash)) return false
  return true
}
