import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { runOfficeCopilot } from '../../../../workers/office-copilot'
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
  const { data: inspections, error } = await admin
    .from('inspection_sessions')
    .select('id,workspace_id,created_by,updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: true })
    .limit(25)

  if (error) return NextResponse.json({ error: 'Could not read completed inspections.', detail: error.message }, { status: 502 })
  const workspaceIds = (inspections ?? []).map((inspection) => inspection.workspace_id)
  await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', 'starting')
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
    if (!settings.enable_office_copilot) { skipped += 1; continue }
    try {
      const eventKey = `office-copilot:${inspection.id}:${inspection.updated_at}`
      await runOfficeCopilot(
        { supabaseUrl, serviceRoleKey, workerId: process.env.AGENT_WORKER_ID?.trim() || 'vercel-cron', workerVersion: process.env.AGENT_WORKER_VERSION?.trim() || 'office-copilot-v1' },
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

  if (failed > 0) {
    await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', 'degraded', { lastError: failures[0]?.error })
    return NextResponse.json({ processed, skipped, failed, failures }, { status: 500 })
  }

  await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', 'healthy')
  return NextResponse.json({ processed, skipped, failed: 0 })
}

export const GET = POST
