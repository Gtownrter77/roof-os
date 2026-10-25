import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { writeWorkerHeartbeats } from '../../../../workers/heartbeat'

export const runtime = 'nodejs'

const ALERT_WINDOW_DAYS = 60

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()
  const windowEnd = new Date(now.getTime() + ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const { data: expiring, error } = await admin
    .from('warranties')
    .select('id, workspace_id, lead_id, manufacturer, product_line, registration_status, expires_at')
    .not('expires_at', 'is', null)
    .gte('expires_at', now.toISOString().slice(0, 10))
    .lte('expires_at', windowEnd.toISOString().slice(0, 10))
    .in('registration_status', ['packet_ready', 'submitted', 'registered'])
    .order('expires_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Could not read expiring warranties.', detail: error.message }, { status: 502 })

  const workspaceIds = [...new Set((expiring ?? []).map((row) => row.workspace_id).filter(Boolean))]

  // Move already-expired registrations out of the active set.
  const { count: expiredCount } = await admin
    .from('warranties')
    .select('id', { count: 'exact', head: true })
    .in('registration_status', ['packet_ready', 'submitted', 'registered'])
    .not('expires_at', 'is', null)
    .lt('expires_at', now.toISOString().slice(0, 10))

  await admin
    .from('warranties')
    .update({ registration_status: 'expired' })
    .in('registration_status', ['packet_ready', 'submitted', 'registered'])
    .not('expires_at', 'is', null)
    .lt('expires_at', now.toISOString().slice(0, 10))

  const owners = new Map<string, string>()
  if (workspaceIds.length) {
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, created_by')
      .in('id', workspaceIds)
      .limit(workspaceIds.length)
    for (const workspace of workspaces ?? []) owners.set(workspace.id, workspace.created_by)
  }

  let created = 0
  let skipped = 0
  for (const warranty of expiring ?? []) {
    const ownerId = owners.get(warranty.workspace_id)
    if (!ownerId) { skipped += 1; continue }

    const automationKey = `warranty-expiry:${warranty.id}:${ALERT_WINDOW_DAYS}`
    const { data: existing } = await admin
      .from('tasks')
      .select('id')
      .eq('workspace_id', warranty.workspace_id)
      .eq('automation_key', automationKey)
      .limit(1)
      .maybeSingle()
    if (existing) { skipped += 1; continue }

    const label = [warranty.manufacturer, warranty.product_line].filter(Boolean).join(' ') || 'Manufacturer warranty'
    const daysLeft = Math.max(0, Math.ceil((new Date(warranty.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    const { error: insertError } = await admin.from('tasks').insert({
      workspace_id: warranty.workspace_id,
      lead_id: warranty.lead_id,
      title: `Warranty expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}: ${label}`,
      due_at: warranty.expires_at,
      assigned_to: ownerId,
      created_by: ownerId,
      status: 'open',
      notes: 'Created by ROOF/OS warranty-expiry agent. Confirm registration and homeowner transfer packet before expiry.',
      automation_key: automationKey,
    })
    if (insertError) { skipped += 1; continue }
    created += 1
  }

  if (workspaceIds.length) {
    await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', 'healthy', { probe: 'warranty-expiry', windowDays: ALERT_WINDOW_DAYS })
  }

  return NextResponse.json({ scanned: expiring?.length ?? 0, created, skipped, expiredRegistrations: expiredCount ?? 0, boundary: 'local-task-alerts-only' })
}
