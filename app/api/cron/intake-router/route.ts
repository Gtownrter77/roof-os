import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { runIntakeRouter } from '../../../../workers/intake-router'
import { writeWorkerHeartbeats } from '../../../../workers/heartbeat'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase worker configuration is incomplete.' }, { status: 503 })
  }

  const admin = createAdminClient()
  // Newest unrouted leads first so a backlog of already-processed leads cannot starve new intake.
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,workspace_id,owner_id,updated_at')
    .eq('status', 'new')
    .not('workspace_id', 'is', null)
    .not('owner_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) return NextResponse.json({ error: 'Could not read new leads.', detail: error.message }, { status: 502 })
  const workspaceIds = (leads ?? []).map((lead) => lead.workspace_id as string)
  await writeWorkerHeartbeats(admin, workspaceIds, 'intake_router', 'starting')

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

  for (const lead of leads ?? []) {
    if (!enabledWorkspaces.has(lead.workspace_id)) { skipped += 1; continue }
    try {
      const eventKey = `intake-router:${lead.id}:${lead.updated_at}`
      await runIntakeRouter(
        { supabaseUrl, serviceRoleKey, workerId: process.env.AGENT_WORKER_ID?.trim() || 'vercel-cron', workerVersion: process.env.AGENT_WORKER_VERSION?.trim() || 'intake-router-v1' },
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

  if (failed > 0) {
    await writeWorkerHeartbeats(admin, workspaceIds, 'intake_router', 'degraded', { lastError: failures[0]?.error })
    return NextResponse.json({ processed, skipped, failed, failures }, { status: 500 })
  }

  await writeWorkerHeartbeats(admin, workspaceIds, 'intake_router', 'healthy')
  return NextResponse.json({ processed, skipped, failed: 0 })
}

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
