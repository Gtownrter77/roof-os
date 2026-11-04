import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
import { idleEnabledWorkspaces } from '../../../../lib/agents/agent-enablement'
import { latestInspectionPhotoTimes, selectUnprocessedCandidates } from '../../../../lib/agents/cron-backlog'
import { runInspectionQuality } from '../../../../workers/inspection-quality'
import { defaultWorkspaceSettings, loadWorkspaceSettings } from '../../../../lib/workspace-settings'

export const POST = createCronAgentRoute({
  agentKey: 'inspection_quality',
  workerVersion: 'inspection-quality-v1',
  requireSupabaseWorker: true,
}, async ({ admin, worker, heartbeat }) => {
  // Scan newest-first past the per-run limit, then skip inspections whose current event key
  // already has a finished run, so a backlog of processed records cannot block new ones.
  const batch = readCronBatchConfig('inspection_quality')
  const { data: inspections, error } = await admin
    .from('inspection_sessions')
    .select('id,workspace_id,created_by,updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: batch.ascending })
    .limit(batch.scanLimit)

  if (error) return NextResponse.json({ error: 'Could not read completed inspections.', detail: error.message }, { status: 502 })
  const settingsByWorkspace = new Map<string, Awaited<ReturnType<typeof loadWorkspaceSettings>>>()
  for (const workspaceId of [...new Set((inspections ?? []).map((inspection) => inspection.workspace_id as string))]) {
    settingsByWorkspace.set(workspaceId, await loadWorkspaceSettings(admin, workspaceId))
  }
  const isEnabled = (workspaceId: string) => (settingsByWorkspace.get(workspaceId) ?? defaultWorkspaceSettings()).enable_inspection_quality_agent
  const disabledCount = (inspections ?? []).filter((inspection) => !isEnabled(inspection.workspace_id)).length
  const enabledInspections = (inspections ?? []).filter((inspection) => isEnabled(inspection.workspace_id))

  let selection
  try {
    const photoTimes = await latestInspectionPhotoTimes(admin, enabledInspections)
    const candidates = enabledInspections.map((inspection) => ({
      inspection,
      workspaceId: inspection.workspace_id as string,
      eventKey: `inspection-quality:${inspection.id}:${photoTimes.get(inspection.id) ?? inspection.updated_at}`,
    }))
    selection = await selectUnprocessedCandidates(admin, 'inspection_quality', candidates, batch.limit)
  } catch (selectionError) {
    return NextResponse.json({ error: 'Could not select pending inspections.', detail: selectionError instanceof Error ? selectionError.message : String(selectionError) }, { status: 502 })
  }

  // Heartbeats only for workspaces where the agent is enabled and has work this run.
  const workspaceIds = selection.pending.map((candidate) => candidate.workspaceId)
  await heartbeat(workspaceIds, 'starting')

  let processed = 0
  let failed = 0
  const skipped = disabledCount
  const alreadyProcessed = selection.alreadyProcessed
  const failures: Array<{ inspectionId: string; error: string }> = []

  for (const { inspection, eventKey } of selection.pending) {
    try {
      await runInspectionQuality(
        worker,
        inspection.workspace_id,
        inspection.id,
        inspection.created_by,
        eventKey,
      )
      processed += 1
    } catch (error) {
      failed += 1
      failures.push({
        inspectionId: inspection.id,
        error: error instanceof Error ? error.message : 'Unknown inspection-quality worker error',
      })
    }
  }

  // Enabled workspaces with no pending work still report in, so a quiet agent can be told
  // apart from an idle one (see lib/agents/agent-alerts.ts). Disabled workspaces get nothing.
  await heartbeat(await idleEnabledWorkspaces(admin, 'inspection_quality', workspaceIds), 'healthy', { idle: true })

  if (failed > 0) {
    await heartbeat(workspaceIds, 'degraded', { lastError: failures[0]?.error })
    return NextResponse.json({ processed, skipped, alreadyProcessed, failed, failures }, { status: 500 })
  }

  await heartbeat(workspaceIds, 'healthy')
  return NextResponse.json({ processed, skipped, alreadyProcessed, failed: 0 })
})

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
