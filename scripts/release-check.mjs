import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const config = readFileSync(join(root, 'next.config.ts'), 'utf8')
if (!config.includes('Content-Security-Policy') || !config.includes('X-Content-Type-Options')) {
  throw new Error('Required security headers are missing from next.config.ts')
}
if (config.includes("'unsafe-eval'")) throw new Error('Production Content Security Policy must not permit unsafe-eval')

const definerHardening = readFileSync(join(root, 'supabase', 'migrations', '031_security_definer_least_privilege.sql'), 'utf8')
for (const functionName of [
  'current_workspace_id',
  'is_system_owner',
  'is_workspace_admin',
  'is_workspace_member',
  'handle_new_user_workspace',
  'create_default_lead_followup',
  'record_lead_status_change',
  'seed_default_automation_rules',
  'book_receptionist_appointment',
]) {
  if (!definerHardening.includes(functionName)) throw new Error(`Least-privilege migration does not cover ${functionName}`)
}
if (!definerHardening.includes('to service_role')) throw new Error('Worker-only function grant is missing from least-privilege migration')

const quotaHardening = readFileSync(join(root, 'supabase', 'migrations', '035_retailer_quota_hardening.sql'), 'utf8')
if (!quotaHardening.includes("query month must be the current UTC month") || !quotaHardening.includes("monthly limit is fixed at 100")) {
  throw new Error('Retailer quota hardening migration does not enforce current-month and fixed-limit boundaries')
}

const activeWorkspace = readFileSync(join(root, 'supabase', 'migrations', '032_active_workspace_selection.sql'), 'utf8')
if (!activeWorkspace.includes('user_active_workspaces') || !activeWorkspace.includes('create policy user_active_workspaces_insert')) {
  throw new Error('Explicit active workspace selection migration is incomplete')
}

const storageHardening = readFileSync(join(root, 'supabase', 'migrations', '033_storage_owner_path_hardening.sql'), 'utf8')
if (!storageHardening.includes('(storage.foldername(name))[2] = auth.uid()::text')) {
  throw new Error('Storage owner-path write guard is missing')
}

const retailerQuota = readFileSync(join(root, 'supabase', 'migrations', '035_retailer_quota_hardening.sql'), 'utf8')
for (const guard of ['auth.uid() is null', 'is_workspace_admin(p_workspace_id)', 'p_query_month is distinct from effective_month', 'p_monthly_limit is distinct from effective_limit', 'grant execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) to service_role']) {
  if (!retailerQuota.includes(guard)) throw new Error(`Retailer pricing quota migration is missing guard: ${guard}`)
}

const routes = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name === 'route.ts') routes.push(path)
  }
}
walk(join(root, 'app', 'api'))
for (const route of routes) {
  const source = readFileSync(route, 'utf8')
  if (!source.includes('getUser()') && !source.includes('CRON_SECRET')) {
    throw new Error(`API route has no visible session or cron authentication guard: ${route}`)
  }
  if (source.includes('request.json()')) {
    throw new Error(`API route bypasses the bounded JSON reader: ${route}`)
  }
  const fetchCallCount = [...source.matchAll(/\bfetch\s*\(/g)].length
  const boundedPhotoAnalysisFetch = route === join(root, 'app', 'api', 'photo-estimate', 'analyze', 'route.ts')
    && fetchCallCount === 2
    && (source.match(/new AbortController\(\)/g) ?? []).length === 2
    && (source.match(/const timer = setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/g) ?? []).length === 2
    && (source.match(/clearTimeout\(timer\)/g) ?? []).length === 2
    && source.includes('async function readBoundedBody(')
    && source.includes('async function fetchBytesWithinBudget(')
    && source.includes('async function fetchTextWithinTimeout(')
    && source.includes('size > maxBytes')
    && source.includes('await readBoundedBody(response, remainingBytes,')
    && source.includes('await readBoundedBody(response, responseLimit,')
    && source.includes('Math.min(STORAGE_TIMEOUT_MS, deadline - Date.now())')
    && source.includes('Math.min(PROVIDER_TIMEOUT_MS, deadline - Date.now())')
  // D.3 keeps both abort timers active while stream-limiting storage and provider response bodies.
  if (fetchCallCount > 0 && !boundedPhotoAnalysisFetch) {
    throw new Error(`API route makes a network request without an approved bounded fetch helper: ${route}`)
  }
}
const protectedWorkspaceRoutes = routes.filter((path) => /claims|measurements|pricing|storms/.test(path))
for (const route of protectedWorkspaceRoutes) {
  const source = readFileSync(route, 'utf8')
  if (!source.includes('requireWorkspaceMember')) {
    throw new Error(`Workspace authorization helper missing from ${route}`)
  }
}

const forbidden = /(?:SUPABASE_SERVICE_ROLE_KEY|CAPOUT_API_KEY|RAPIDAPI_KEY)\s*=\s*(?!your_|server_only_|validation-only-)[A-Za-z0-9_\-./]+/g
for (const path of routes) {
  const source = readFileSync(path, 'utf8')
  if (forbidden.test(source)) throw new Error(`Possible hard-coded secret in ${path}`)
}

const migrationDir = join(root, 'supabase', 'migrations')
const migrations = readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))
const versions = new Map()
for (const name of migrations) {
  const match = name.match(/^(\d+)_/)
  if (!match) throw new Error(`Migration has no numeric version prefix: ${name}`)
  versions.set(match[1], [...(versions.get(match[1]) ?? []), name].sort())
}
const collisions = Object.fromEntries([...versions].filter(([, names]) => names.length > 1))
const knownLegacyCollisions = {
  '021': ['021_agent_runs_idempotency_contract.sql', '021_photo_estimate_workflows.sql'],
  '022': ['022_photo_estimate_workflows.sql', '022_soffit_measurement_fields.sql'],
  '023': ['023_photo_refresh_decisions.sql', '023_soffit_measurement_fields.sql'],
}
const canonical = (value) => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
if (JSON.stringify(canonical(collisions)) !== JSON.stringify(canonical(knownLegacyCollisions))) {
  throw new Error(`Migration version collisions changed unexpectedly: ${JSON.stringify(collisions)}`)
}
console.log(`release-check passed: ${protectedWorkspaceRoutes.length} protected routes, security headers, and secret scan verified`)
