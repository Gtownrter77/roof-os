// Per-workspace agent on/off switches backed by `automation_rules` (seeded by migration 005).
// Pure helpers only (type-only imports) so tests can load this with --experimental-strip-types.
//
// Row-level security (migration 014) lets workspace members read the rules but only the
// system owner write them. The settings route writes through the signed-in user's client, so
// that rule is never bypassed; a blocked write comes back as a clear 403 rather than a silent no-op.
import type { ManagedAgentKey } from './agent-enablement'

export type AgentToggleInfo = { agentKey: ManagedAgentKey; label: string; desc: string; settingsFlag?: string }

export const AGENT_TOGGLES: AgentToggleInfo[] = [
  { agentKey: 'intake_router', label: 'Intake Router (Agent 1)', desc: 'Reviews new leads and plans first-response actions for approval.' },
  { agentKey: 'scheduler', label: 'Scheduler / Receptionist follow-ups (Agent 2)', desc: 'Status follow-up tasks and receptionist retry calls.', settingsFlag: 'enable_ai_receptionist' },
  { agentKey: 'inspection_quality', label: 'Inspection Quality (Agent 3)', desc: 'Checks photo completeness and opens review tasks.', settingsFlag: 'enable_inspection_quality_agent' },
  { agentKey: 'office_copilot', label: 'Office Copilot (Agent 4)', desc: 'Drafts office actions from inspections for human approval. Off by default.' },
]

const AGENT_KEYS = new Set<string>(AGENT_TOGGLES.map((toggle) => toggle.agentKey))

export type AgentToggleState = AgentToggleInfo & { enabled: boolean | null; updatedAt: string | null }

/** Merge stored rule rows with the known agents. `enabled: null` means the rule row was never seeded. */
export function mergeAgentToggles(rows: Array<{ agent_key?: unknown; enabled?: unknown; updated_at?: unknown }> | null | undefined): AgentToggleState[] {
  const byKey = new Map<string, { enabled: boolean; updatedAt: string | null }>()
  for (const row of rows ?? []) {
    if (typeof row.agent_key !== 'string' || !AGENT_KEYS.has(row.agent_key)) continue
    byKey.set(row.agent_key, { enabled: row.enabled === true, updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null })
  }
  return AGENT_TOGGLES.map((toggle) => {
    const stored = byKey.get(toggle.agentKey)
    return { ...toggle, enabled: stored ? stored.enabled : null, updatedAt: stored?.updatedAt ?? null }
  })
}

export type AgentToggleUpdate = { agentKey: ManagedAgentKey; enabled: boolean }

export function parseAgentToggleUpdate(body: unknown): AgentToggleUpdate | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send { "agent_key": "...", "enabled": true|false }.' }
  const record = body as Record<string, unknown>
  const agentKey = record.agent_key
  if (typeof agentKey !== 'string' || !AGENT_KEYS.has(agentKey)) return { error: 'Unknown agent.' }
  if (typeof record.enabled !== 'boolean') return { error: 'enabled must be true or false.' }
  return { agentKey: agentKey as ManagedAgentKey, enabled: record.enabled }
}
