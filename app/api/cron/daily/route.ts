import { NextRequest, NextResponse } from 'next/server'
import { POST as runInspectionQuality } from '../inspection-quality/route'
import { POST as runIntakeRouter } from '../intake-router/route'
import { POST as runOfficeCopilot } from '../office-copilot/route'
import { POST as runReceptionistFollowups } from '../receptionist-followups/route'
import { POST as runWarrantyExpiry } from '../warranty-expiry/route'
import { POST as runAgentAlerts } from '../agent-alerts/route'
import { readCronDryRun } from '../../../../lib/agents/cron-route'
import { CRON_ALERTS_TIMEOUT_MS, cronJobTimeoutMs } from '../../../../lib/agents/cron-batch-config'

export const runtime = 'nodejs'

type JobResult = { status: number; body: unknown }

// Each job gets its own deadline so one slow agent cannot hold back the rest or the alerts.
// The timer only stops waiting; it does not cancel the job, which is idempotent per run key.
async function invoke(name: string, job: (request: NextRequest) => Promise<NextResponse>, request: NextRequest, timeoutMs = cronJobTimeoutMs()): Promise<[string, JobResult]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<JobResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: 504, body: { error: `Job timed out after ${timeoutMs}ms.`, timeoutMs } }), timeoutMs)
  })
  const work = (async (): Promise<JobResult> => {
    const response = await job(request)
    const body = await response.json().catch(() => null)
    return { status: response.status, body }
  })()
  try {
    return [name, await Promise.race([work, timeout])]
  } catch (error) {
    return [name, { status: 500, body: { error: error instanceof Error ? error.message : 'Unknown cron job error' } }]
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Run jobs side by side; a rejected or thrown job becomes a 500 entry instead of failing the batch. */
async function settleAll(jobs: Array<[string, Promise<[string, JobResult]>]>): Promise<Record<string, JobResult>> {
  const settled = await Promise.allSettled(jobs.map(([, promise]) => promise))
  return Object.fromEntries(settled.map((outcome, index): [string, JobResult] => outcome.status === 'fulfilled'
    ? outcome.value
    : [jobs[index][0], { status: 500, body: { error: outcome.reason instanceof Error ? outcome.reason.message : 'Unknown cron job error' } }]))
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Dry-run only reaches jobs that support it; every other job is reported, not run.
  if (await readCronDryRun(request)) {
    const dryResults = await settleAll([
      ['intake_router', invoke('intake_router', runIntakeRouter, request)],
      ['office_copilot', invoke('office_copilot', runOfficeCopilot, request)],
    ])
    // Alerts run after the agent jobs so they see this run's heartbeats.
    const [dryAlertName, dryAlertResult] = await invoke('agent_alerts', runAgentAlerts, request, CRON_ALERTS_TIMEOUT_MS)
    dryResults[dryAlertName] = dryAlertResult
    const dispatched = Object.keys(dryResults).length
    const skippedJobs = ['inspection_quality', 'receptionist_followups', 'warranty_expiry']
    for (const job of skippedJobs) dryResults[job] = { status: 204, body: { skipped: 'dry_run_unsupported' } }
    const dryFailed = Object.values(dryResults).filter((result) => result.status >= 500).length
    return NextResponse.json({ dryRun: true, processed: dispatched, failed: dryFailed, results: dryResults }, { status: dryFailed ? 207 : 200 })
  }

  const results = await settleAll([
    ['intake_router', invoke('intake_router', runIntakeRouter, request)],
    ['inspection_quality', invoke('inspection_quality', runInspectionQuality, request)],
    ['office_copilot', invoke('office_copilot', runOfficeCopilot, request)],
    ['receptionist_followups', invoke('receptionist_followups', runReceptionistFollowups, request)],
    ['warranty_expiry', invoke('warranty_expiry', runWarrantyExpiry, request)],
  ])
  // Alerts run after the agent jobs so they see this run's heartbeats.
  const [alertName, alertResult] = await invoke('agent_alerts', runAgentAlerts, request, CRON_ALERTS_TIMEOUT_MS)
  results[alertName] = alertResult

  const failed = Object.values(results).filter((result) => result.status >= 500).length
  return NextResponse.json({ processed: Object.keys(results).length, failed, results }, { status: failed ? 207 : 200 })
}

// Vercel Cron invokes scheduled paths with GET; POST is kept for manual dispatch.
export const GET = run
export const POST = run
