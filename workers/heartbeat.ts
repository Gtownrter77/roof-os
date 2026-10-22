import type { SupabaseClient } from '@supabase/supabase-js'

type HeartbeatAgent = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'
type HeartbeatStatus = 'starting' | 'healthy' | 'degraded' | 'stopped'

export async function writeWorkerHeartbeats(
  supabase: SupabaseClient,
  workspaceIds: string[],
  agentKey: HeartbeatAgent,
  status: HeartbeatStatus,
  capabilities: Record<string, unknown> = {},
) {
  const uniqueWorkspaceIds = [...new Set(workspaceIds.filter(Boolean))]
  if (!uniqueWorkspaceIds.length) return { persisted: 0, errors: false }
  const workerId = process.env.AGENT_WORKER_ID?.trim() || 'vercel-cron'
  const workerVersion = process.env.AGENT_WORKER_VERSION?.trim() || `${agentKey}-cron-v1`
  const results = await Promise.all(uniqueWorkspaceIds.map(async (workspaceId) => {
    try {
      const { error } = await supabase.from('agent_worker_heartbeats').upsert({
        workspace_id: workspaceId,
        agent_key: agentKey,
        worker_id: workerId,
        worker_version: workerVersion,
        status,
        capabilities,
        last_seen_at: new Date().toISOString(),
      })
      return !error
    } catch {
      return false
    }
  }))
  return { persisted: results.filter(Boolean).length, errors: results.some((success) => !success) }
}
