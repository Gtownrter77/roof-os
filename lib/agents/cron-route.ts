import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../supabase/admin'
import { writeWorkerHeartbeats } from '../../workers/heartbeat'
import {
  isCronAuthorized,
  isDryRunRequested,
  parseDryRunBody,
  readSupabaseWorkerConfig,
  readWorkerIdentity,
} from './cron-guard'

export type CronHeartbeatAgent = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'
export type CronHeartbeatStatus = 'starting' | 'healthy' | 'degraded'

export type CronWorkerConfig = {
  supabaseUrl: string
  serviceRoleKey: string
  workerId: string
  workerVersion: string
}

export type CronAgentContext = {
  request: NextRequest
  admin: SupabaseClient
  /** Present when the route requires the Supabase service-role worker configuration. */
  worker: CronWorkerConfig
  /** True when `?dryRun=1` or `{ "dryRun": true }` was supplied and the route supports it. */
  dryRun: boolean
  /** Writes this agent's heartbeats. A no-op in dry-run mode. */
  heartbeat: (workspaceIds: string[], status: CronHeartbeatStatus, capabilities?: Record<string, unknown>) => Promise<void>
}

export type CronAgentRouteOptions = {
  /** Agent whose heartbeats this route writes; null for monitoring routes that write none. */
  agentKey: CronHeartbeatAgent | null
  /** Default AGENT_WORKER_VERSION for this route. */
  workerVersion: string
  /** Answer 503 'Supabase worker configuration is incomplete.' when the service role is missing. */
  requireSupabaseWorker: boolean
  /** Additional route-specific configuration check; return a response to stop (e.g. a 503). */
  checkConfig?: () => NextResponse | null
  /** Accept `?dryRun=1` / `{ "dryRun": true }`. Routes without dry-run support ignore the flag. */
  supportsDryRun?: boolean
}

export async function readCronDryRun(request: NextRequest): Promise<boolean> {
  let body: unknown = null
  if (request.method === 'POST' && request.headers.get('content-type')?.includes('application/json')) {
    body = parseDryRunBody(await request.clone().text().catch(() => ''))
  }
  return isDryRunRequested(request.url, body)
}

/**
 * Shared cron entry point: CRON_SECRET bearer auth (401), service-role configuration (503),
 * optional dry-run parsing, and an agent-scoped heartbeat writer. The handler owns the
 * agent-specific reads, per-record work, and response bodies.
 */
export function createCronAgentRoute(
  options: CronAgentRouteOptions,
  handler: (context: CronAgentContext) => Promise<NextResponse>,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isCronAuthorized(request.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const supabase = readSupabaseWorkerConfig()
    if (options.requireSupabaseWorker && !supabase) {
      return NextResponse.json({ error: 'Supabase worker configuration is incomplete.' }, { status: 503 })
    }

    const configError = options.checkConfig?.() ?? null
    if (configError) return configError

    const dryRun = options.supportsDryRun ? await readCronDryRun(request) : false
    const admin = createAdminClient()
    const worker: CronWorkerConfig = {
      supabaseUrl: supabase?.supabaseUrl ?? '',
      serviceRoleKey: supabase?.serviceRoleKey ?? '',
      ...readWorkerIdentity(options.workerVersion),
    }

    async function heartbeat(workspaceIds: string[], status: CronHeartbeatStatus, capabilities: Record<string, unknown> = {}) {
      if (dryRun) return
      if (!options.agentKey) return
      await writeWorkerHeartbeats(admin, workspaceIds, options.agentKey, status, capabilities)
    }

    return handler({ request, admin, worker, dryRun, heartbeat })
  }
}
