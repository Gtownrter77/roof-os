import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
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
    .limit(batch.limit)

  if (error) return NextResponse.json({ error: 'Could not read completed inspections.', detail: error.message }, { status: 502 })
  const workspaceIds = (inspections ?? []).map((inspection) => inspection.workspace_id)
  await heartbeat(workspaceIds, 'starting')

  // Office Copilot is seeded disabled (migration 005). Only workspaces whose office_copilot
  // automation rule is explicitly enabled are processed; a missing rule or read error skips.
  const enabledWorkspaces = new Set<string>()
  const uniqueWorkspaceIds = [...new Set(workspaceIds)]
  if (uniqueWorkspaceIds.length) {
    const { data: rules, error: rulesError } = await admin
      .from('automation_rules')
      .select('workspace_id,enabled')
      .eq('agent_key', 'office_copilot')
      .in('workspace_id', uniqueWorkspaceIds)
    if (!rulesError) {
      for (const rule of rules ?? []) if (rule.enabled === true) enabledWorkspaces.add(rule.workspace_id as string)
    }
  }

  let processed = 0
  let failed = 0
  let skipped = 0
  const failures: Array<{ inspectionId: string; error: string }> = []
  const planned: Array<Record<string, unknown>> = []

  for (const inspection of inspections ?? []) {
    if (!enabledWorkspaces.has(inspection.workspace_id)) { skipped += 1; continue }
    try {
      const { data: latestPhoto } = await admin
        .from('inspection_photos')
        .select('updated_at')
        .eq('inspection_id', inspection.id)
        .eq('workspace_id', inspection.workspace_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const eventKey = `office-copilot:${inspection.id}:${latestPhoto?.updated_at ?? inspection.updated_at}`
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
    return NextResponse.json({ dryRun: true, processed, skipped, failed, failures, planned }, { status: failed > 0 ? 500 : 200 })
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
