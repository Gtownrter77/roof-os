// Which workspaces have an agent switched on. Read-only; type-only imports so tests can load
// it with --experimental-strip-types.
//
// An agent is enabled for a workspace when its `automation_rules` row exists with
// `enabled = true` (seeded by migration 005). Inspection Quality and the Scheduler are also
// gated by a workspace_settings flag; an explicit `false` there turns them off.
// Read errors fail closed (empty set), so a broken read never makes a disabled agent look on.
import type { SupabaseClient } from '@supabase/supabase-js'

export type ManagedAgentKey = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'
export const MANAGED_AGENT_KEYS: ManagedAgentKey[] = ['intake_router', 'scheduler', 'inspection_quality', 'office_copilot']

export const AGENT_SETTINGS_FLAG: Partial<Record<ManagedAgentKey, string>> = {
  inspection_quality: 'enable_inspection_quality_agent',
  scheduler: 'enable_ai_receptionist',
}

const MAX_ENABLED_WORKSPACES = 500

export async function listEnabledAgentWorkspaces(
  supabase: SupabaseClient,
  agentKey: ManagedAgentKey,
): Promise<Set<string>> {
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('workspace_id')
    .eq('agent_key', agentKey)
    .eq('enabled', true)
    .limit(MAX_ENABLED_WORKSPACES)
  if (error) return new Set()
  const enabled = new Set(((rules ?? []) as Array<{ workspace_id: string }>).map((rule) => rule.workspace_id).filter(Boolean))
  const flag = AGENT_SETTINGS_FLAG[agentKey]
  if (!flag || !enabled.size) return enabled
  const { data: settings, error: settingsError } = await supabase
    .from('workspace_settings')
    .select(`workspace_id,${flag}`)
    .in('workspace_id', [...enabled])
  if (settingsError) return new Set()
  for (const row of (settings ?? []) as unknown as Array<Record<string, unknown>>) {
    if (row[flag] === false) enabled.delete(row.workspace_id as string)
  }
  return enabled
}

/** Enabled workspaces that had no pending work this run; they get an idle `healthy` heartbeat. */
export async function idleEnabledWorkspaces(
  supabase: SupabaseClient,
  agentKey: ManagedAgentKey,
  activeWorkspaceIds: string[],
): Promise<string[]> {
  const active = new Set(activeWorkspaceIds)
  const enabled = await listEnabledAgentWorkspaces(supabase, agentKey)
  return [...enabled].filter((workspaceId) => !active.has(workspaceId))
}
