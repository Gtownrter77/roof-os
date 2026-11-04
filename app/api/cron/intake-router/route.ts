import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
import { enabledAutomationWorkspaces, selectUnprocessedCandidates } from '../../../../lib/agents/cron-backlog'
import { intakeRouterBatchKey, intakeRouterBatchSummary, planIntakeRouterForLead, runIntakeRouter } from '../../../../workers/intake-router'

export const POST = createCronAgentRoute({
  agentKey: 'intake_router',
  workerVersion: 'intake-router-v1',
  requireSupabaseWorker: true,
  supportsDryRun: true,
}, async ({ admin, worker, dryRun, heartbeat }) => {
  // Newest-first (see lib/agents/cron-batch-config.ts) and scanned past the per-run limit
  // so a backlog of already-routed leads cannot starve new intake.
  const batch = readCronBatchConfig('intake_router')
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,workspace_id,owner_id,updated_at')
    .eq('status', 'new')
    .not('workspace_id', 'is', null)
    .not('owner_id', 'is', null)
    .order('created_at', { ascending: batch.ascending })
    .limit(batch.scanLimit)

  if (error) return NextResponse.json({ error: 'Could not read new leads.', detail: error.message }, { status: 502 })

  // Per-workspace enablement mirrors the database follow-up trigger: the intake_router
  // automation rule must exist and be enabled. A missing rule or read error skips (fail closed).
  const enabledWorkspaces = await enabledAutomationWorkspaces(admin, 'intake_router', (leads ?? []).map((lead) => lead.workspace_id as string))
  const enabledLeads = (leads ?? []).filter((lead) => enabledWorkspaces.has(lead.workspace_id))
  const skipped = (leads ?? []).length - enabledLeads.length

  let selection
  try {
    const candidates = enabledLeads.map((lead) => ({
      lead,
      workspaceId: lead.workspace_id as string,
      eventKey: `intake-router:${lead.id}:${lead.updated_at}`,
    }))
    // Leads already routed for their current event key are skipped before the limit applies.
    selection = await selectUnprocessedCandidates(admin, 'intake_router', candidates, batch.limit)
  } catch (selectionError) {
    return NextResponse.json({ error: 'Could not select pending leads.', detail: selectionError instanceof Error ? selectionError.message : String(selectionError) }, { status: 502 })
  }

  // Heartbeats only for workspaces where the agent is enabled and has work this run.
  const workspaceIds = selection.pending.map((candidate) => candidate.workspaceId)
  await heartbeat(workspaceIds, 'starting')

  let processed = 0
  let failed = 0
  const alreadyProcessed = selection.alreadyProcessed
  const failures: Array<{ leadId: string; error: string }> = []
  const planned: Array<Record<string, unknown>> = []

  for (const { lead, eventKey } of selection.pending) {
    try {
      if (dryRun) {
        // Read-only: plan the action batch without agent_runs, batches, tasks, or heartbeats.
        const { lead: record, plan } = await planIntakeRouterForLead(admin, lead.workspace_id, lead.id, lead.owner_id)
        planned.push({
          workspaceId: lead.workspace_id,
          leadId: lead.id,
          eventKey,
          // No batch is persisted when nothing is left to propose (see runIntakeRouter).
          batchKey: plan.actions.length ? intakeRouterBatchKey(lead.id, eventKey) : null,
          summary: intakeRouterBatchSummary(record.name, plan),
          duplicateLeadIds: plan.duplicateLeadIds,
          actions: plan.actions,
        })
        processed += 1
        continue
      }
      await runIntakeRouter(
        worker,
        lead.workspace_id,
        lead.id,
        lead.owner_id,
        eventKey,
      )
      processed += 1
    } catch (error) {
      failed += 1
      failures.push({
        leadId: lead.id,
        error: error instanceof Error ? error.message : 'Unknown intake-router worker error',
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
