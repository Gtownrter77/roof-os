// The orchestrator is the sole writer of adjuster claim state. Agents propose
// work; only a transition through here changes a claim. Execution transitions
// are blocked until an owner explicitly authorizes them (PLAN ONLY default).

import { JARVIS_JOB_TYPES, JARVIS_LOGICAL_AGENT_COUNT, type ClaimStatus, type JarvisJobType } from './types.ts'

/** The existing 15 logical JARVIS agents. The adjuster is folded into them. */
export const JARVIS_AGENT_KEYS = [
  'intake_router',
  'scheduler',
  'inspection_quality',
  'office_copilot',
  'receptionist',
  'estimator',
  'supplement_specialist',
  'drone_pilot',
  'photo_analyst',
  'warranty_tracker',
  'follow_up',
  'billing',
  'qc_reviewer',
  'report_writer',
  'safety_officer',
] as const

export type ClaimState = {
  status: ClaimStatus
  disabled: boolean
  planOnly: boolean
  authorized: boolean
}

export const SCOPED_CAPABILITIES: Record<string, readonly JarvisJobType[]> = {
  intake_router: ['run_claim_plan', 'sandbox_action'],
  scheduler: ['send_message', 'update_claim_status'],
  inspection_quality: ['extract_estimate', 'sandbox_action'],
  office_copilot: ['generate_document', 'extract_estimate'],
  receptionist: ['send_message'],
  estimator: ['extract_estimate', 'generate_document'],
  supplement_specialist: ['generate_document'],
  report_writer: ['generate_document'],
}

export function canAgentRun(agentKey: string, jobType: JarvisJobType | string): boolean {
  return (SCOPED_CAPABILITIES[agentKey] ?? []).includes(jobType as JarvisJobType)
}

const EXECUTION_EVENTS = new Set(['contacted', 'estimate_extracted', 'quote_sent'])

const ALLOWED: Record<string, { from: ClaimStatus[]; to: ClaimStatus }> = {
  plan_created: { from: ['new'], to: 'planned' },
  contacted: { from: ['planned'], to: 'contacted' },
  estimate_extracted: { from: ['contacted'], to: 'estimating' },
  quote_sent: { from: ['estimating'], to: 'quoted' },
  won: { from: ['quoted', 'estimating'], to: 'won' },
  lost: { from: ['quoted', 'estimating'], to: 'lost' },
  cancel: { from: ['new', 'planned', 'contacted', 'estimating', 'quoted'], to: 'cancelled' },
}

export function applyTransition(state: ClaimState, event: string): {
  claim: ClaimState
  changed: boolean
  reason?: 'unknown_event' | 'invalid_transition' | 'disabled' | 'plan_only'
} {
  const rule = ALLOWED[event]
  if (!rule) return { claim: state, changed: false, reason: 'unknown_event' }
  if (event !== 'cancel' && state.disabled) return { claim: state, changed: false, reason: 'disabled' }
  if (!rule.from.includes(state.status)) return { claim: state, changed: false, reason: 'invalid_transition' }
  if (EXECUTION_EVENTS.has(event) && state.planOnly && !state.authorized) {
    return { claim: state, changed: false, reason: 'plan_only' }
  }
  return {
    claim: { ...state, status: rule.to, disabled: event === 'cancel' ? true : state.disabled },
    changed: true,
  }
}

/** Stop control: cancel the claim and all of its queued work in one decision. */
export function stopClaim(state: ClaimState): ClaimState {
  return { ...state, status: 'cancelled', disabled: true }
}

// Fail closed if someone adds a 16th agent or an unhandled job type later.
if (JARVIS_AGENT_KEYS.length !== JARVIS_LOGICAL_AGENT_COUNT) {
  throw new Error('JARVIS must have exactly 15 logical agents')
}
if (!JARVIS_JOB_TYPES.every((type) => Object.values(SCOPED_CAPABILITIES).some((types) => types.includes(type)))) {
  throw new Error('every queue job type must be scoped to an existing agent')
}
