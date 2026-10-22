// Batch 3: Top 25 Improvements 21-25 — minimal stubs
// Human-gated. No authoritative writes.

export type PaymentPromptDraft = {
  type: 'deposit' | 'financing'
  message: string
  requiresApproval: true
}

export function draftPaymentPrompt(input: {
  estimateTotal: number
  hasFinancing: boolean
}): PaymentPromptDraft {
  return {
    type: input.hasFinancing ? 'financing' : 'deposit',
    message: input.hasFinancing
      ? `Financing options available for $${input.estimateTotal.toFixed(0)}. Technician must approve on desktop.`
      : `Deposit link draft for $${(input.estimateTotal * 0.3).toFixed(0)}. Not active.`,
    requiresApproval: true,
  }
}

export type AuditEvent = {
  kind: 'draft_created' | 'share_copied' | 'check_in'
  at: string
  note: string
}

export function recordDraftCreated(kind: string): AuditEvent {
  return {
    kind: 'draft_created',
    at: new Date().toISOString(),
    note: `Draft ${kind} created — requires desktop approval`,
  }
}

export type DomainNote = {
  contract: string
  status: 'shared' | 'pending'
}

export function sharedDomainNote(): DomainNote {
  return {
    contract: 'Photo metadata, status enums, and approval flags are defined once and imported by field and web.',
    status: 'pending',
  }
}

export type AgentAction = {
  action: string
  status: 'queued' | 'done'
  requiresApproval: true
}

export function queueAgenticDraft(action: string): AgentAction {
  return {
    action,
    status: 'queued',
    requiresApproval: true,
  }
}
