export type AgentKey = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'

export type AgentRegistration = {
  agentKey: AgentKey
  label: string
  implemented: boolean
  entryPoint: string | null
  heartbeatSource: string | null
}

export type HeartbeatRecord = {
  status?: string | null
  last_seen_at?: string | null
}

export const AGENT_KEYS: AgentKey[] = ['intake_router', 'scheduler', 'inspection_quality', 'office_copilot']

const REGISTRATIONS: Record<AgentKey, AgentRegistration> = {
  intake_router: {
    agentKey: 'intake_router',
    label: 'Intake and Lead Router',
    implemented: true,
    entryPoint: 'workers/intake-router.ts',
    heartbeatSource: 'workers/intake-router.ts',
  },
  scheduler: {
    agentKey: 'scheduler',
    label: 'Scheduler and Follow-up Coordinator',
    implemented: true,
    entryPoint: '/api/cron/receptionist-followups',
    heartbeatSource: 'app/api/cron/receptionist-followups/route.ts',
  },
  inspection_quality: {
    agentKey: 'inspection_quality',
    label: 'Inspection Quality Agent',
    implemented: true,
    entryPoint: '/api/cron/inspection-quality',
    heartbeatSource: 'app/api/cron/inspection-quality/route.ts',
  },
  office_copilot: {
    agentKey: 'office_copilot',
    label: 'Office Copilot and Report Agent',
    implemented: true,
    entryPoint: 'workers/office-copilot.ts',
    heartbeatSource: 'workers/office-copilot.ts',
  },
}

export function getAgentRegistration(agentKey: AgentKey): AgentRegistration {
  return REGISTRATIONS[agentKey]
}

export function evaluateAgentReadiness(
  registration: AgentRegistration,
  heartbeat: HeartbeatRecord | null | undefined,
  now: string | Date = new Date(),
  freshnessMs = 5 * 60 * 1000,
) {
  if (!registration.implemented) return { ready: false, reason: 'worker_not_registered' as const }
  if (!heartbeat) return { ready: false, reason: 'heartbeat_missing' as const }
  if (heartbeat.status === 'stopped') return { ready: false, reason: 'worker_stopped' as const }
  if (heartbeat.status !== 'healthy') return { ready: false, reason: 'worker_not_healthy' as const }
  const seenAt = heartbeat.last_seen_at ? Date.parse(heartbeat.last_seen_at) : Number.NaN
  const nowMs = typeof now === 'string' ? Date.parse(now) : now.getTime()
  if (!Number.isFinite(seenAt) || !Number.isFinite(nowMs) || nowMs - seenAt > freshnessMs || seenAt > nowMs) {
    return { ready: false, reason: 'heartbeat_stale' as const }
  }
  return { ready: true, reason: 'healthy' as const }
}
