import { NextRequest, NextResponse } from 'next/server'
import { POST as runInspectionQuality } from '../inspection-quality/route'
import { POST as runIntakeRouter } from '../intake-router/route'
import { POST as runOfficeCopilot } from '../office-copilot/route'
import { POST as runReceptionistFollowups } from '../receptionist-followups/route'
import { POST as runWarrantyExpiry } from '../warranty-expiry/route'
import { readCronDryRun } from '../../../../lib/agents/cron-route'

export const runtime = 'nodejs'

type JobResult = { status: number; body: unknown }

async function invoke(name: string, job: (request: NextRequest) => Promise<NextResponse>, request: NextRequest): Promise<[string, JobResult]> {
  try {
    const response = await job(request)
    const body = await response.json().catch(() => null)
    return [name, { status: response.status, body }]
  } catch (error) {
    return [name, { status: 500, body: { error: error instanceof Error ? error.message : 'Unknown cron job error' } }]
  }
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Dry-run only reaches jobs that support it; every other job is reported, not run.
  if (await readCronDryRun(request)) {
    const dryResults = Object.fromEntries(await Promise.all([
      invoke('intake_router', runIntakeRouter, request),
      invoke('office_copilot', runOfficeCopilot, request),
    ]))
    const dispatched = Object.keys(dryResults).length
    const skippedJobs = ['inspection_quality', 'receptionist_followups', 'warranty_expiry']
    for (const job of skippedJobs) dryResults[job] = { status: 204, body: { skipped: 'dry_run_unsupported' } }
    const dryFailed = Object.values(dryResults).filter((result) => result.status >= 500).length
    return NextResponse.json({ dryRun: true, processed: dispatched, failed: dryFailed, results: dryResults }, { status: dryFailed ? 207 : 200 })
  }

  const results = Object.fromEntries(await Promise.all([
    invoke('intake_router', runIntakeRouter, request),
    invoke('inspection_quality', runInspectionQuality, request),
    invoke('office_copilot', runOfficeCopilot, request),
    invoke('receptionist_followups', runReceptionistFollowups, request),
    invoke('warranty_expiry', runWarrantyExpiry, request),
  ]))

  const failed = Object.values(results).filter((result) => result.status >= 500).length
  return NextResponse.json({ processed: Object.keys(results).length, failed, results }, { status: failed ? 207 : 200 })
}

// Vercel Cron invokes scheduled paths with GET; POST is kept for manual dispatch.
export const GET = run
export const POST = run
