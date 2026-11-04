import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { readCronBatchConfig } from '../../../../lib/agents/cron-batch-config'
import { intakeRouterBatchKey, intakeRouterBatchSummary, planIntakeRouterForLead, runIntakeRouter } from '../../../../workers/intake-router'

export const POST = createCronAgentRoute({
  agentKey: 'intake_router',
  workerVersion: 'intake-router-v1',
  requireSupabaseWorker: true,
  supportsDryRun: true,
}, async ({ admin, worker, dryRun, heartbeat }) => {
  // Default newest-first (see lib/agents/cron-batch-config.ts) so a backlog of
  // already-processed leads cannot starve new intake.
  const batch = readCronBatchConfig('intake_router')
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,workspace_id,owner_id,updated_at')
    .eq('status', 'new')
    .not('workspace_id', 'is', null)
    .not('owner_id', 'is', null)
    .order('created_at', { ascending: batch.ascending })
    .limit(batch.limit)

  if (error) return NextResponse.json({ error: 'Could not read new leads.', detail: error.message }, { status: 502 })
  const workspaceIds = (leads ?? []).map((lead) => lead.workspace_id as string)
  await heartbeat(workspaceIds, 'starting')

  // Per-workspace enablement mirrors the database follow-up trigger: the intake_router
  // automation rule must exist and be enabled. A missing rule or read error skips (fail closed).
  const enabledWorkspaces = new Set<string>()
  const uniqueWorkspaceIds = [...new Set(workspaceIds)]
  if (uniqueWorkspaceIds.length) {
    const { data: rules, error: rulesError } = await admin
      .from('automation_rules')
      .select('workspace_id,enabled')
      .eq('agent_key', 'intake_router')
      .in('workspace_id', uniqueWorkspaceIds)
    if (!rulesError) {
      for (const rule of rules ?? []) if (rule.enabled === true) enabledWorkspaces.add(rule.workspace_id as string)
    }
  }

  let processed = 0
  let failed = 0
  let skipped = 0
  const failures: Array<{ leadId: string; error: string }> = []
  const planned: Array<Record<string, unknown>> = []

  for (const lead of leads ?? []) {
    if (!enabledWorkspaces.has(lead.workspace_id)) { skipped += 1; continue }
    try {
      const eventKey = `intake-router:${lead.id}:${lead.updated_at}`
      if (dryRun) {
        // Read-only: plan the action batch without agent_runs, batches, tasks, or heartbeats.
        const { lead: record, plan } = await planIntakeRouterForLead(admin, lead.workspace_id, lead.id, lead.owner_id)
        planned.push({
          workspaceId: lead.workspace_id,
          leadId: lead.id,
          eventKey,
          batchKey: intakeRouterBatchKey(lead.id, eventKey),
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
