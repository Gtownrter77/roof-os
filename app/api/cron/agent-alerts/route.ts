import { NextResponse } from 'next/server'
import { createCronAgentRoute } from '../../../../lib/agents/cron-route'
import { MANAGED_AGENT_KEYS, listEnabledAgentWorkspaces } from '../../../../lib/agents/agent-enablement'
import { agentAlertTask, agentAlertTaskKey, findAgentAlerts, readAlertStaleHours } from '../../../../lib/agents/agent-alerts'

// Free-only alerting: degraded or quiet (>24h) agents become an open in-app task for the
// workspace owner. No email, SMS, or paid service. `?dryRun=1` reports alerts without writes.
export const POST = createCronAgentRoute({
  agentKey: null,
  workerVersion: 'agent-alerts-v1',
  requireSupabaseWorker: true,
  supportsDryRun: true,
}, async ({ admin, dryRun }) => {
  const enabled: Array<{ workspaceId: string; agentKey: string }> = []
  for (const agentKey of MANAGED_AGENT_KEYS) {
    for (const workspaceId of await listEnabledAgentWorkspaces(admin, agentKey)) enabled.push({ workspaceId, agentKey })
  }
  const workspaceIds = [...new Set(enabled.map((entry) => entry.workspaceId))]
  if (!workspaceIds.length) return NextResponse.json({ dryRun: dryRun || undefined, checked: 0, alerts: [], created: 0 })

  const { data: heartbeats, error } = await admin
    .from('agent_worker_heartbeats')
    .select('workspace_id,agent_key,status,last_seen_at')
    .in('workspace_id', workspaceIds)
    .in('agent_key', MANAGED_AGENT_KEYS)
  if (error) return NextResponse.json({ error: 'Could not read worker heartbeats.', detail: error.message }, { status: 502 })

  const now = new Date()
  const alerts = findAgentAlerts({ heartbeats: heartbeats ?? [], enabled, now, staleHours: readAlertStaleHours() })
  const planned = alerts.map((alert) => ({ ...alert, automationKey: agentAlertTaskKey(alert, now), ...agentAlertTask(alert) }))
  if (dryRun) return NextResponse.json({ dryRun: true, checked: enabled.length, alerts: planned, created: 0 })

  let created = 0
  let existing = 0
  const failures: Array<{ workspaceId: string; agentKey: string; error: string }> = []
  for (const alert of planned) {
    try {
      // One open alert per workspace + agent: do not stack daily tasks while one is unresolved.
      const { data: open, error: openError } = await admin
        .from('tasks')
        .select('id')
        .eq('workspace_id', alert.workspaceId)
        .eq('status', 'open')
        .like('automation_key', `agent-alert:${alert.agentKey}:%`)
        .limit(1)
        .maybeSingle()
      if (openError) throw openError
      if (open) { existing += 1; continue }

      const { data: owner, error: ownerError } = await admin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', alert.workspaceId)
        .eq('role', 'owner')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (ownerError) throw ownerError
      if (!owner?.user_id) throw new Error('Workspace has no owner to assign the alert task to.')

      const { error: insertError } = await admin.from('tasks').insert({
        workspace_id: alert.workspaceId,
        title: alert.title,
        notes: alert.notes,
        assigned_to: owner.user_id,
        created_by: owner.user_id,
        status: 'open',
        due_at: now.toISOString(),
        automation_key: alert.automationKey,
      })
      // 23505: today's alert task already exists (unique workspace_id + automation_key).
      if (insertError && insertError.code !== '23505') throw insertError
      if (insertError) existing += 1
      else created += 1
    } catch (alertError) {
      failures.push({
        workspaceId: alert.workspaceId,
        agentKey: alert.agentKey,
        error: alertError instanceof Error ? alertError.message : (alertError as { message?: string })?.message ?? 'Unknown alert error',
      })
    }
  }

  return NextResponse.json(
    { checked: enabled.length, alerts: planned.length, created, existing, failed: failures.length, failures },
    { status: failures.length ? 500 : 200 },
  )
})

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
