// Pure helpers shared by every agent cron route. No imports so they can be unit tested
// directly with `node --experimental-strip-types`.

type Env = Record<string, string | undefined>

export type SupabaseWorkerConfig = { supabaseUrl: string; serviceRoleKey: string }

/** Bearer-token check against CRON_SECRET. Fails closed when the secret is unset. */
export function isCronAuthorized(authorization: string | null | undefined, env: Env = process.env): boolean {
  const secret = env.CRON_SECRET?.trim()
  const supplied = authorization?.replace(/^Bearer\s+/i, '')
  return Boolean(secret) && supplied === secret
}

/** Service-role worker configuration, or null when incomplete (routes answer 503). */
export function readSupabaseWorkerConfig(env: Env = process.env): SupabaseWorkerConfig | null {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) return null
  return { supabaseUrl, serviceRoleKey }
}

export function readWorkerIdentity(defaultVersion: string, env: Env = process.env) {
  return {
    workerId: env.AGENT_WORKER_ID?.trim() || 'vercel-cron',
    workerVersion: env.AGENT_WORKER_VERSION?.trim() || defaultVersion,
  }
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

/** `?dryRun=1` (also `true`/`yes`/`on`) or a JSON body `{ "dryRun": true }`. */
export function isDryRunRequested(url: string, body?: unknown): boolean {
  try {
    const value = new URL(url).searchParams.get('dryRun') ?? new URL(url).searchParams.get('dry_run')
    if (value !== null && TRUE_VALUES.has(value.trim().toLowerCase())) return true
  } catch {
    // An unparsable URL never enables dry-run.
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const flag = (body as Record<string, unknown>).dryRun
    return flag === true || (typeof flag === 'string' && TRUE_VALUES.has(flag.trim().toLowerCase()))
  }
  return false
}

/** Parse a small JSON body for the dry-run flag only. Anything else is ignored. */
export function parseDryRunBody(text: string): unknown {
  if (!text || text.length > 4096) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
