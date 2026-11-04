import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
import { enabledAutomationWorkspaces, latestInspectionPhotoTimes, selectUnprocessedCandidates } from '../../../../lib/agents/cron-backlog'
import { officeCopilotBatchKey, officeCopilotBatchSummary, planOfficeCopilotForInspection, runOfficeCopilot } from '../../../../workers/office-copilot'

export const POST = createCronAgentRoute({
  agentKey: 'office_copilot',
  workerVersion: 'office-copilot-v1',
  requireSupabaseWorker: true,
  supportsDryRun: true,
}, async ({ admin, worker, dryRun, heartbeat }) => {
  const batch = readCronBatchConfig('office_copilot')
  const { data: inspections, error } = await admin
    .from('inspection_sessions')
    .select('id,workspace_id,created_by,updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: batch.ascending })
    .limit(batch.scanLimit)

  if (error) return NextResponse.json({ error: 'Could not read completed inspections.', detail: error.message }, { status: 502 })

  // Office Copilot is seeded disabled (migration 005). Only workspaces whose office_copilot
  // automation rule is explicitly enabled are processed; a missing rule or read error skips.
  const enabledWorkspaces = await enabledAutomationWorkspaces(admin, 'office_copilot', (inspections ?? []).map((inspection) => inspection.workspace_id as string))
  const enabledInspections = (inspections ?? []).filter((inspection) => enabledWorkspaces.has(inspection.workspace_id))
  let skipped = (inspections ?? []).length - enabledInspections.length

  let selection
  try {
    const photoTimes = await latestInspectionPhotoTimes(admin, enabledInspections)
    const candidates = enabledInspections.map((inspection) => ({
      inspection,
      workspaceId: inspection.workspace_id as string,
      eventKey: `office-copilot:${inspection.id}:${photoTimes.get(inspection.id) ?? inspection.updated_at}`,
    }))
    // Already-processed inspections are skipped before the per-run limit applies.
    selection = await selectUnprocessedCandidates(admin, 'office_copilot', candidates, batch.limit)
  } catch (selectionError) {
    return NextResponse.json({ error: 'Could not select pending inspections.', detail: selectionError instanceof Error ? selectionError.message : String(selectionError) }, { status: 502 })
  }

  // Heartbeats only for workspaces where the agent is enabled and has work this run.
  const workspaceIds = selection.pending.map((candidate) => candidate.workspaceId)
  await heartbeat(workspaceIds, 'starting')

  let processed = 0
  let failed = 0
  const alreadyProcessed = selection.alreadyProcessed
  const failures: Array<{ inspectionId: string; error: string }> = []
  const planned: Array<Record<string, unknown>> = []

  for (const { inspection, eventKey } of selection.pending) {
    try {
      if (dryRun) {
        // Read-only: plan the review batch without agent_runs, batches, model calls, or heartbeats.
        const plan = await planOfficeCopilotForInspection(admin, inspection.workspace_id, inspection.id, inspection.created_by)
        if ('reason' in plan) { skipped += 1; continue }
        planned.push({
          workspaceId: inspection.workspace_id,
          inspectionId: inspection.id,
          eventKey,
          batchKey: officeCopilotBatchKey(inspection.id, eventKey),
          summary: officeCopilotBatchSummary(plan.leadName),
          deficiencies: plan.draft.deficiencies,
          actions: plan.actions,
        })
        processed += 1
        continue
      }
      await runOfficeCopilot(
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
        error: error instanceof Error ? error.message : 'Unknown office-copilot worker error',
      })
    }
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, processed, skipped, alreadyProcessed, failed, failures, planned }, { status: failed > 0 ? 500 : 200 })
  }

  if (failed > 0) {
    await heartbeat(workspaceIds, 'degraded', { lastError: failures[0]?.error })
    return NextResponse.json({ processed, skipped, alreadyProcessed, failed, failures }, { status: 500 })
  }

  await heartbeat(workspaceIds, 'healthy')
  return NextResponse.json({ processed, skipped, alreadyProcessed, failed: 0 })
})

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
