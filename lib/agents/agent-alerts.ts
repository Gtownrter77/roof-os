// Free, in-app alerts for quiet or failing agents. Pure module (no imports).
//
// For every (workspace, agent) where the agent is enabled, the latest heartbeat is checked:
// - `degraded`: the last run reported failures.
// - `stale`: the last heartbeat is older than the stale window (default 24h). Enabled
//   agents write an idle `healthy` heartbeat every run, so a quiet agent means the
//   scheduled run stopped reaching that workspace.
// Workspaces with no heartbeat at all are not alerted (the agent has never run there,
// e.g. Twilio is not configured for the scheduler); /api/cron/heartbeat reports those.

export type AlertHeartbeat = {
  workspace_id: string
  agent_key: string
  status: string
  last_seen_at: string | null
}

export type AgentAlertReason = 'degraded' | 'stale'

export type AgentAlert = {
  workspaceId: string
  agentKey: string
  reason: AgentAlertReason
  lastSeenAt: string | null
  ageHours: number | null
}

export const DEFAULT_ALERT_STALE_HOURS = 24

export function readAlertStaleHours(env: Record<string, string | undefined> = process.env): number {
  const raw = env.AGENT_ALERT_STALE_HOURS?.trim()
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_ALERT_STALE_HOURS
  const hours = Number.parseInt(raw, 10)
  return hours >= 1 && hours <= 24 * 30 ? hours : DEFAULT_ALERT_STALE_HOURS
}

/** Latest heartbeat per workspace + agent (a workspace can have several worker ids). */
export function latestHeartbeats(rows: AlertHeartbeat[]): Map<string, AlertHeartbeat> {
  const latest = new Map<string, AlertHeartbeat>()
  for (const row of rows) {
    const key = `${row.workspace_id}\u0000${row.agent_key}`
    const current = latest.get(key)
    const seen = row.last_seen_at ? Date.parse(row.last_seen_at) : Number.NaN
    const currentSeen = current?.last_seen_at ? Date.parse(current.last_seen_at) : Number.NaN
    if (!current || (Number.isFinite(seen) && (!Number.isFinite(currentSeen) || seen > currentSeen))) latest.set(key, row)
  }
  return latest
}

export function findAgentAlerts(input: {
  heartbeats: AlertHeartbeat[]
  enabled: Array<{ workspaceId: string; agentKey: string }>
  now?: Date
  staleHours?: number
}): AgentAlert[] {
  const nowMs = (input.now ?? new Date()).getTime()
  const staleMs = (input.staleHours ?? DEFAULT_ALERT_STALE_HOURS) * 60 * 60 * 1000
  const latest = latestHeartbeats(input.heartbeats)
  const alerts: AgentAlert[] = []
  for (const { workspaceId, agentKey } of input.enabled) {
    const heartbeat = latest.get(`${workspaceId}\u0000${agentKey}`)
    if (!heartbeat) continue
    const seen = heartbeat.last_seen_at ? Date.parse(heartbeat.last_seen_at) : Number.NaN
    const ageMs = Number.isFinite(seen) ? nowMs - seen : Number.POSITIVE_INFINITY
    const ageHours = Number.isFinite(ageMs) ? Math.round((ageMs / 3_600_000) * 10) / 10 : null
    if (ageMs > staleMs) {
      alerts.push({ workspaceId, agentKey, reason: 'stale', lastSeenAt: heartbeat.last_seen_at, ageHours })
    } else if (heartbeat.status === 'degraded') {
      alerts.push({ workspaceId, agentKey, reason: 'degraded', lastSeenAt: heartbeat.last_seen_at, ageHours })
    }
  }
  return alerts
}

/** One open alert task per workspace + agent + reason per UTC day. */
export function agentAlertTaskKey(alert: Pick<AgentAlert, 'agentKey' | 'reason'>, now: Date = new Date()): string {
  return `agent-alert:${alert.agentKey}:${alert.reason}:${now.toISOString().slice(0, 10)}`
}

export const AGENT_LABELS: Record<string, string> = {
  intake_router: 'Intake Router',
  scheduler: 'Scheduler (receptionist follow-ups)',
  inspection_quality: 'Inspection Quality',
  office_copilot: 'Office Copilot',
}

export function agentAlertTask(alert: AgentAlert) {
  const label = AGENT_LABELS[alert.agentKey] ?? alert.agentKey
  const title = alert.reason === 'degraded'
    ? `Agent alert: ${label} is failing`
    : `Agent alert: ${label} has been quiet for over ${Math.floor(alert.ageHours ?? 24)}h`
  const notes = alert.reason === 'degraded'
    ? `The last ${label} run reported failures (heartbeat ${alert.lastSeenAt ?? 'unknown'}). Check /api/cron/heartbeat and the agent run log, then complete this task.`
    : `No ${label} heartbeat since ${alert.lastSeenAt ?? 'unknown'}. The scheduled cron may not be reaching this workspace. Check Vercel Cron and CRON_SECRET, or turn the agent off in Settings.`
  return { title, notes }
}
