// Backlog-safe candidate selection for the agent cron routes.
//
// The routes read up to `scanLimit` candidates, compute each candidate's deterministic
// event key, drop candidates whose agent run already finished (or is running) for that
// exact event key, and only then apply the per-run `limit`. Already-processed records
// therefore cannot fill the batch and starve new work.
// Read-only: every query here is a select. Only type imports, so tests can load it with
// --experimental-strip-types.
import type { SupabaseClient } from '@supabase/supabase-js'

/** agent_runs statuses that agent-runtime treats as done or in flight for an event key. */
export const PROCESSED_RUN_STATUSES = ['succeeded', 'needs_review', 'running'] as const

const EVENT_KEY_CHUNK = 100

export type BacklogCandidate = { workspaceId: string; eventKey: string }

function runKey(workspaceId: string, eventKey: string) {
  return `${workspaceId}\u0000${eventKey}`
}

/**
 * Returns `workspaceId + eventKey` pairs that already have a finished or running agent run.
 * Matching is workspace-scoped: the same event key in another workspace does not count.
 */
export async function findProcessedEventKeys(
  supabase: SupabaseClient,
  agentKey: string,
  candidates: BacklogCandidate[],
): Promise<Set<string>> {
  const processed = new Set<string>()
  const eventKeys = [...new Set(candidates.map((candidate) => candidate.eventKey))]
  for (let index = 0; index < eventKeys.length; index += EVENT_KEY_CHUNK) {
    const chunk = eventKeys.slice(index, index + EVENT_KEY_CHUNK)
    const { data, error } = await supabase
      .from('agent_runs')
      .select('workspace_id,event_key')
      .eq('agent_key', agentKey)
      .in('event_key', chunk)
      .in('status', [...PROCESSED_RUN_STATUSES])
    if (error) throw error
    for (const row of (data ?? []) as Array<{ workspace_id: string; event_key: string }>) {
      processed.add(runKey(row.workspace_id, row.event_key))
    }
  }
  return processed
}

/** Keeps the scan order, drops processed candidates, and caps the result at `limit`. */
export function selectPendingCandidates<T extends BacklogCandidate>(
  candidates: T[],
  processed: Set<string>,
  limit: number,
): { pending: T[]; alreadyProcessed: number } {
  const pending: T[] = []
  let alreadyProcessed = 0
  for (const candidate of candidates) {
    if (processed.has(runKey(candidate.workspaceId, candidate.eventKey))) { alreadyProcessed += 1; continue }
    if (pending.length < limit) pending.push(candidate)
  }
  return { pending, alreadyProcessed }
}

/** Convenience wrapper: one agent_runs lookup, then selection. */
export async function selectUnprocessedCandidates<T extends BacklogCandidate>(
  supabase: SupabaseClient,
  agentKey: string,
  candidates: T[],
  limit: number,
) {
  const processed = await findProcessedEventKeys(supabase, agentKey, candidates)
  return selectPendingCandidates(candidates, processed, limit)
}

const PHOTO_SCAN_LIMIT = 1000

/**
 * Latest inspection-photo timestamp per inspection, workspace-scoped, used for the
 * inspection_quality and office_copilot event keys. One bulk read; inspections the bulk
 * read could not cover (truncated result) fall back to a single-row read each.
 */
export async function latestInspectionPhotoTimes(
  supabase: SupabaseClient,
  inspections: Array<{ id: string; workspace_id: string }>,
): Promise<Map<string, string>> {
  const latest = new Map<string, string>()
  if (!inspections.length) return latest
  const workspaceById = new Map(inspections.map((inspection) => [inspection.id, inspection.workspace_id]))
  const { data, error } = await supabase
    .from('inspection_photos')
    .select('inspection_id,workspace_id,updated_at')
    .in('inspection_id', inspections.map((inspection) => inspection.id))
    .order('updated_at', { ascending: false })
    .limit(PHOTO_SCAN_LIMIT)
  if (error) throw error
  const rows = (data ?? []) as Array<{ inspection_id: string; workspace_id: string; updated_at: string }>
  for (const row of rows) {
    if (workspaceById.get(row.inspection_id) !== row.workspace_id) continue
    if (!latest.has(row.inspection_id)) latest.set(row.inspection_id, row.updated_at)
  }
  if (rows.length >= PHOTO_SCAN_LIMIT) {
    for (const inspection of inspections) {
      if (latest.has(inspection.id)) continue
      const { data: photo, error: photoError } = await supabase
        .from('inspection_photos')
        .select('updated_at')
        .eq('inspection_id', inspection.id)
        .eq('workspace_id', inspection.workspace_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (photoError) throw photoError
      if (photo?.updated_at) latest.set(inspection.id, photo.updated_at as string)
    }
  }
  return latest
}

/** Workspaces whose automation rule for `agentKey` exists and is enabled (fail closed). */
export async function enabledAutomationWorkspaces(
  supabase: SupabaseClient,
  agentKey: string,
  workspaceIds: string[],
): Promise<Set<string>> {
  const enabled = new Set<string>()
  const unique = [...new Set(workspaceIds.filter(Boolean))]
  if (!unique.length) return enabled
  const { data, error } = await supabase
    .from('automation_rules')
    .select('workspace_id,enabled')
    .eq('agent_key', agentKey)
    .in('workspace_id', unique)
  if (error) return enabled
  for (const rule of (data ?? []) as Array<{ workspace_id: string; enabled: boolean }>) {
    if (rule.enabled === true) enabled.add(rule.workspace_id)
  }
  return enabled
}
