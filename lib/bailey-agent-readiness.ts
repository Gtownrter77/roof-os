import { BAILEY_AGENT_CATALOG, type BaileyAgentKey, type BaileyAgentSetup, type BaileyAgentSetupStatus } from './bailey-agent-onboarding.ts'
import { AGENT_KEYS, evaluateAgentReadiness, getAgentRegistration, type AgentKey, type HeartbeatRecord } from '../workers/agent-registry.ts'

// Descriptive relationship ONLY. These four older workers are not the BAILEY 15-agent implementation.
// Do not use this mapping to dispatch work, grant access, or treat an agent as operational.
export const BAILEY_LEGACY_WORKER_RELATIONS: Record<BaileyAgentKey, readonly AgentKey[]> = {
  orchestrator: ['intake_router', 'office_copilot'],
  chief_of_staff: ['office_copilot'],
  personal_calling: [],
  business_receptionist: ['intake_router'],
  outbound_sales: ['scheduler'],
  scheduling: ['scheduler'],
  customer_care: ['scheduler'],
  roofing_estimator: [],
  production_foreman: [],
  purchasing: [],
  finance: [],
  research: [],
  documents: ['office_copilot'],
  development: [],
  quality_security: ['inspection_quality'],
}

export type BaileyExistingWorkerEvidence = {
  workerKey: AgentKey
  label: string
  ready: boolean
  reason: string
  evidenceType: 'legacy_worker_heartbeat'
}

export type BaileyAgentReadiness = {
  key: BaileyAgentKey
  label: string
  preference: BaileyAgentSetup[BaileyAgentKey]
  setupStatus: BaileyAgentSetupStatus
  implementedAsBaileyAgent: false
  operational: false
  executionAuthorized: false
  relatedWorkers: BaileyExistingWorkerEvidence[]
  classification: 'not_implemented'
}

// Intentionally never promotes a BAILEY agent to operational from preferences or legacy heartbeats.
export function describeBaileyAgentReadiness(
  setup: BaileyAgentSetup,
  setupStatus: BaileyAgentSetupStatus,
  heartbeats: Partial<Record<AgentKey, HeartbeatRecord>>,
  now: Date | string = new Date(),
): BaileyAgentReadiness[] {
  return BAILEY_AGENT_CATALOG.map((agent) => ({
    key: agent.key,
    label: agent.label,
    preference: setup[agent.key],
    setupStatus,
    implementedAsBaileyAgent: false,
    operational: false,
    executionAuthorized: false,
    classification: 'not_implemented',
    relatedWorkers: BAILEY_LEGACY_WORKER_RELATIONS[agent.key].map((workerKey) => {
      const registration = getAgentRegistration(workerKey)
      const assessment = evaluateAgentReadiness(registration, heartbeats[workerKey] ?? null, now)
      return {
        workerKey,
        label: registration.label,
        ready: assessment.ready,
        reason: assessment.reason,
        evidenceType: 'legacy_worker_heartbeat' as const,
      }
    }),
  }))
}

// A visible marker for the dispatcher integration work still required.
// This never gates or enables the legacy runtime (which is unaffected).
export function baileyDispatchIsAuthorized(_agentKey: BaileyAgentKey, _setup: BaileyAgentSetup): false {
  return false
}

export const EXISTING_LEGACY_WORKER_KEYS: readonly AgentKey[] = AGENT_KEYS
