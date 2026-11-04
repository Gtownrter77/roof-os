import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
import { runInspectionQuality } from '../../../../workers/inspection-quality'
import { defaultWorkspaceSettings, loadWorkspaceSettings } from '../../../../lib/workspace-settings'

export const POST = createCronAgentRoute({
  agentKey: 'inspection_quality',
  workerVersion: 'inspection-quality-v1',
  requireSupabaseWorker: true,
}, async ({ admin, worker, heartbeat }) => {
  const batch = readCronBatchConfig('inspection_quality')
  const { data: inspections, error } = await admin
    .from('inspection_sessions')
    .select('id,workspace_id,created_by,updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: batch.ascending })
    .limit(batch.limit)

  if (error) return NextResponse.json({ error: 'Could not read completed inspections.', detail: error.message }, { status: 502 })
  const workspaceIds = (inspections ?? []).map((inspection) => inspection.workspace_id)
  await heartbeat(workspaceIds, 'starting')
  const settingsByWorkspace = new Map<string, Awaited<ReturnType<typeof loadWorkspaceSettings>>>()
  for (const workspaceId of [...new Set(workspaceIds)]) {
    settingsByWorkspace.set(workspaceId, await loadWorkspaceSettings(admin, workspaceId))
  }

  let processed = 0
  let failed = 0
  let skipped = 0
  const failures: Array<{ inspectionId: string; error: string }> = []

  for (const inspection of inspections ?? []) {
    const settings = settingsByWorkspace.get(inspection.workspace_id) ?? defaultWorkspaceSettings()
    if (!settings.enable_inspection_quality_agent) { skipped += 1; continue }
    try {
      const { data: latestPhoto } = await admin
        .from('inspection_photos')
        .select('updated_at')
        .eq('inspection_id', inspection.id)
        .eq('workspace_id', inspection.workspace_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const eventKey = `inspection-quality:${inspection.id}:${latestPhoto?.updated_at ?? inspection.updated_at}`
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

  if (failed > 0) {
    await heartbeat(workspaceIds, 'degraded', { lastError: failures[0]?.error })
    return NextResponse.json({ processed, skipped, failed, failures }, { status: 500 })
  }

  await heartbeat(workspaceIds, 'healthy')
  return NextResponse.json({ processed, skipped, failed: 0 })
})

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
