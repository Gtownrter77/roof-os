import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const config = readFileSync(join(root, 'next.config.ts'), 'utf8')
if (!config.includes('Content-Security-Policy') || !config.includes('X-Content-Type-Options')) {
  throw new Error('Required security headers are missing from next.config.ts')
}

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

const routes = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name === 'route.ts') routes.push(path)
  }
}
walk(join(root, 'app', 'api'))
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
console.log(`release-check passed: ${protectedWorkspaceRoutes.length} protected routes, security headers, and secret scan verified`)
