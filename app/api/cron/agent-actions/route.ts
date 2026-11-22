import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { executeApprovedBatch, requeueStaleExecutingBatches } from '../../../../workers/action-executor'
import { writeWorkerHeartbeats } from '../../../../workers/heartbeat'
import { enabledAutomationWorkspaces } from '../../../../lib/agents/cron-backlog'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const admin = createAdminClient()
  const failures: Array<{ batchId: string; error: string }> = []
  // A crashed worker can leave a batch `executing` with no owner. Replay is safe
  // (task creation is automation_key-keyed; owner assignment is value-idempotent),
  // so reset only bounded, stale claims. Housekeeping is best-effort: a DB error
  // here must not skip every approved batch.
  try {
    await requeueStaleExecutingBatches(admin)
  } catch (reaperError) {
    failures.push({ batchId: 'reaper', error: reaperError instanceof Error ? reaperError.message : 'Unknown stale-batch reaper error' })
  }
  const { data: batches, error } = await admin
    .from('agent_action_batches')
    .select('id,workspace_id')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(25)
  if (error) return NextResponse.json({ error: 'Could not read approved action batches.', detail: error.message }, { status: 502 })
  // Approved batches still execute, but office_copilot heartbeats are only written for
  // workspaces where that agent is enabled, so a disabled agent never looks alive.
  const enabledWorkspaces = await enabledAutomationWorkspaces(admin, 'office_copilot', (batches ?? []).map((batch) => batch.workspace_id as string))
  const workspaceIds = (batches ?? []).map((batch) => batch.workspace_id).filter((workspaceId) => enabledWorkspaces.has(workspaceId))
  await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', 'starting')

  let executed = 0
  let failed = 0
  let skipped = 0
  for (const batch of batches ?? []) {
    try {
      const result = await executeApprovedBatch(admin, batch.id)
      executed += result.executed
      failed += result.failed
      skipped += result.skipped
      failures.push(...result.failures.map((error) => ({ batchId: batch.id, error })))
    } catch (workerError) {
      failed += 1
      failures.push({ batchId: batch.id, error: workerError instanceof Error ? workerError.message : 'Unknown action executor error' })
    }
  }
  await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', failures.length ? 'degraded' : 'healthy', failures.length ? { lastError: failures[0]?.error } : {})
  return NextResponse.json({ processed: batches?.length ?? 0, executed, failed, skipped, failures }, { status: failures.length ? 502 : 200 })
}
