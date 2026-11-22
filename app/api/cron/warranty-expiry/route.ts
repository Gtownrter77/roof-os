import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { writeWorkerHeartbeats } from '../../../../workers/heartbeat'
import { actionableWarranties, alreadyTaskedWarrantyIds, automationKeyForWarranty, warrantyWindow } from '../../../../lib/warranty/expiry-window'

export const runtime = 'nodejs'

const ALERT_WINDOW_DAYS = 60
const PAGE_SIZE = 200
const MAX_PAGES = 50

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const admin = createAdminClient()
  const now = new Date()
  const window = warrantyWindow(now, ALERT_WINDOW_DAYS)
  if (!window) return NextResponse.json({ error: 'The alert clock is invalid.' }, { status: 500 })

  // Move already-expired registrations out of the active set in bounded batches.
  const { data: expiredRows, error: expiredError } = await admin
    .from('warranties')
    .select('id')
    .in('registration_status', ['packet_ready', 'submitted', 'registered'])
    .not('expires_at', 'is', null)
    .lt('expires_at', window.nowIso)
    .limit(500)

  if (expiredError) return NextResponse.json({ error: 'Could not read expired warranties.', detail: expiredError.message }, { status: 502 })

  const expiredIds = (expiredRows ?? []).map((row) => row.id)
  if (expiredIds.length && !dryRun) {
    const { error: updateError } = await admin
      .from('warranties')
      .update({ registration_status: 'expired' })
      .in('id', expiredIds)
    if (updateError) return NextResponse.json({ error: 'Could not expire warranties.', detail: updateError.message }, { status: 502 })
  }

  // Filter already-tasked rows page by page, then fill the alert target. A
  // single LIMIT 200 before the filter let an old batch of task-bearing rows
  // starve every later warranty in expiry order forever.
  const expiring: Array<{
    id: string
    workspace_id: string
    lead_id: string | null
    manufacturer: string | null
    product_line: string | null
    registration_status: string
    expires_at: string
  }> = []
  let pageFrom = 0
  while (expiring.length < 200 && pageFrom < PAGE_SIZE * MAX_PAGES) {
    const { data: page, error: pageError } = await admin
      .from('warranties')
      .select('id, workspace_id, lead_id, manufacturer, product_line, registration_status, expires_at')
      .not('expires_at', 'is', null)
      .gte('expires_at', window.nowIso)
      .lte('expires_at', window.windowEndIso)
      .in('registration_status', ['packet_ready', 'submitted', 'registered'])
      .order('expires_at', { ascending: true })
      .range(pageFrom, pageFrom + PAGE_SIZE - 1)
    if (pageError) return NextResponse.json({ error: 'Could not read expiring warranties.', detail: pageError.message }, { status: 502 })
    if (!page?.length) break
    const keys = page.map((row) => automationKeyForWarranty(row.id, ALERT_WINDOW_DAYS))
    const { data: existingTasks } = await admin
      .from('tasks')
      .select('automation_key')
      .in('automation_key', keys)
    const alreadyTasked = alreadyTaskedWarrantyIds(existingTasks ?? [], ALERT_WINDOW_DAYS)
    expiring.push(...actionableWarranties(page as typeof expiring, alreadyTasked, ALERT_WINDOW_DAYS, 200 - expiring.length))
    pageFrom += page.length
    if (page.length < PAGE_SIZE) break
  }

  const workspaceIds = [...new Set((expiring ?? []).map((row) => row.workspace_id).filter(Boolean))]

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
  let wouldCreate = 0
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
    if (dryRun) { wouldCreate += 1; continue }

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

  if (!dryRun && workspaceIds.length) {
    await writeWorkerHeartbeats(admin, workspaceIds, 'office_copilot', 'healthy', { probe: 'warranty-expiry', windowDays: ALERT_WINDOW_DAYS })
  }

  return NextResponse.json({
    dryRun,
    scanned: expiring?.length ?? 0,
    created,
    wouldCreate,
    skipped,
    expiredRegistrations: expiredIds.length,
    boundary: 'local-task-alerts-only',
  })
}

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
