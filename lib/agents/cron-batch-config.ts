// Shared batch sizing and ordering for the agent cron routes.
// Pure module (no imports) so contract tests can load it with --experimental-strip-types.

export type CronBatchAgent = 'intake_router' | 'inspection_quality' | 'office_copilot' | 'scheduler'
export type CronBatchOrder = 'newest' | 'oldest'
export type CronBatchConfig = {
  /** Maximum records processed in one run. */
  limit: number
  /** How many candidate records to read so already-processed ones cannot starve new work. */
  scanLimit: number
  order: CronBatchOrder
  /** Convenience for Supabase `.order(column, { ascending })`. */
  ascending: boolean
}

type Env = Record<string, string | undefined>

export const DEFAULT_CRON_BATCH_LIMIT = 25
export const MAX_CRON_BATCH_LIMIT = 200
/** Candidates scanned per processed record when skipping already-handled events. */
export const CRON_SCAN_MULTIPLIER = 4

export const DEFAULT_CRON_BATCH_ORDER: Record<CronBatchAgent, CronBatchOrder> = {
  // New leads first so a backlog of routed leads cannot starve new intake.
  intake_router: 'newest',
  inspection_quality: 'oldest',
  office_copilot: 'oldest',
  // The follow-up queue is due-time driven; oldest queued attempts go first.
  scheduler: 'oldest',
}

function envPrefix(agent: CronBatchAgent): string {
  return agent.toUpperCase()
}

function parseLimit(value: string | undefined): number | null {
  if (value === undefined || !value.trim()) return null
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.min(parsed, MAX_CRON_BATCH_LIMIT)
}

function parseOrder(value: string | undefined): CronBatchOrder | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'newest' || normalized === 'desc') return 'newest'
  if (normalized === 'oldest' || normalized === 'asc') return 'oldest'
  return null
}

/**
 * Resolve the batch limit and sort order for an agent cron run.
 *
 * Environment overrides (all optional; invalid values fall back to defaults):
 * - `<AGENT>_CRON_BATCH_LIMIT`, e.g. `INSPECTION_QUALITY_CRON_BATCH_LIMIT=50`
 * - `AGENT_CRON_BATCH_LIMIT` (applies to every agent without its own override)
 * - `<AGENT>_CRON_ORDER` = `newest` | `oldest`
 * Limits are clamped to 1..MAX_CRON_BATCH_LIMIT.
 */
export function readCronBatchConfig(agent: CronBatchAgent, env: Env = process.env): CronBatchConfig {
  const prefix = envPrefix(agent)
  const limit = parseLimit(env[`${prefix}_CRON_BATCH_LIMIT`])
    ?? parseLimit(env.AGENT_CRON_BATCH_LIMIT)
    ?? DEFAULT_CRON_BATCH_LIMIT
  const order = parseOrder(env[`${prefix}_CRON_ORDER`]) ?? DEFAULT_CRON_BATCH_ORDER[agent]
  return {
    limit,
    scanLimit: Math.min(limit * CRON_SCAN_MULTIPLIER, MAX_CRON_BATCH_LIMIT),
    order,
    ascending: order === 'oldest',
  }
}
