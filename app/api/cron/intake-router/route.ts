import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { runIntakeRouter } from '../../../../workers/intake-router'
import { writeWorkerHeartbeats } from '../../../../workers/heartbeat'
import { defaultWorkspaceSettings, loadWorkspaceSettings } from '../../../../lib/workspace-settings'

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
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,workspace_id,created_by,created_at')
    .is('owner_id', null)
    .order('created_at', { ascending: true })
    .limit(25)

  if (error) return NextResponse.json({ error: 'Could not read unowned leads.', detail: error.message }, { status: 502 })
  const workspaceIds = (leads ?? []).map((lead) => lead.workspace_id)
  await writeWorkerHeartbeats(admin, workspaceIds, 'intake_router', 'starting')
  const settingsByWorkspace = new Map<string, Awaited<ReturnType<typeof loadWorkspaceSettings>>>()
  for (const workspaceId of [...new Set(workspaceIds)]) {
    settingsByWorkspace.set(workspaceId, await loadWorkspaceSettings(admin, workspaceId))
  }

  let processed = 0
  let failed = 0
  let skipped = 0
  const failures: Array<{ leadId: string; error: string }> = []

  for (const lead of leads ?? []) {
    const settings = settingsByWorkspace.get(lead.workspace_id) ?? defaultWorkspaceSettings()
    if (!settings.enable_intake_router) { skipped += 1; continue }
    try {
      const eventKey = `intake-router:${lead.id}:${lead.created_at}`
      await runIntakeRouter(
        { supabaseUrl, serviceRoleKey, workerId: process.env.AGENT_WORKER_ID?.trim() || 'vercel-cron', workerVersion: process.env.AGENT_WORKER_VERSION?.trim() || 'intake-router-v1' },
        lead.workspace_id,
        lead.id,
        lead.created_by,
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

export const GET = POST
