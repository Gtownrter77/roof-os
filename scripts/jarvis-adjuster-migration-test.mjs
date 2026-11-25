import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source contract gate for migration 114. A live Postgres is not available in
// this workspace, so this gate proves that the SQL and the application adapters
// agree on the same RPC surface: no direct authenticated writes, mandatory
// hash/key, durable stop flags, atomic inbound writes and auto-enrollment.
// It does NOT claim that a hosted migration has been applied.

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const sql = read('supabase/migrations/114_jarvis_adjuster.sql')
const adapter = read('lib/jarvis/api/server.ts')
const claimsRoute = read('app/api/jarvis/claims/route.ts')
const inboundRoute = read('app/api/jarvis/inbound/route.ts')
const settingsRoute = read('app/api/jarvis/settings/route.ts')
const workerRoute = read('app/api/jarvis/worker/route.ts')

function definition(name) {
  const start = sql.indexOf(`create or replace function public.${name}(`)
  assert.notEqual(start, -1, `${name} must exist in migration 114`)
  const marker = sql.indexOf('$$;', start)
  assert.notEqual(marker, -1, `${name} must have a function body`)
  return sql.slice(start, marker)
}

function body(name) {
  const declaration = definition(name)
  const open = declaration.indexOf('$$')
  return declaration.slice(open + 2)
}

// Tables: mandatory dedupe columns, real FKs, and durable controls.
assert.match(sql, /create table if not exists public\.adjuster_claims/)
assert.match(sql, /disabled boolean not null default false/)
assert.match(sql, /create table if not exists public\.jarvis_jobs/)
assert.match(sql, /payload_hash text not null,[\s\S]*?idempotency_key text not null,/)
assert.match(sql, /claim_id uuid references public\.adjuster_claims\(id\) on delete set null/)
assert.match(sql, /create table if not exists public\.workspace_adjuster_settings/)
assert.match(sql, /adjuster_enabled boolean not null default true/)
assert.match(sql, /plan_only boolean not null default true/)
for (const table of ['jarvis_jobs', 'adjuster_claims', 'adjuster_messages', 'workspace_adjuster_settings']) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
  assert.match(sql, new RegExp(`drop policy if exists \\w+ on public\\.${table}`), `${table} must be replay-safe`)
  assert.match(sql, new RegExp(`create policy \\w+ on public\\.${table}[\\s\\S]*?public\\.is_workspace_member\\(workspace_id\\)`))
}
assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)\s+on\s+(public\.)?(jarvis_jobs|adjuster_claims|adjuster_messages|workspace_adjuster_settings)\s+to\s+authenticated/i)

// Every mutating RPC is definer-only with a pinned search path.
const RPCS = [
  'jarvis_enqueue_job', 'adjuster_enroll_claim', 'adjuster_record_inbound',
  'adjuster_set_claim_disabled', 'adjuster_set_workspace_enabled',
]
for (const name of RPCS) {
  const declaration = definition(name)
  assert.match(declaration, /security definer/)
  assert.match(declaration, /set search_path = public/)
}

// Enqueue: hash/key are mandatory, membership or verified service role,
// stop controls enforced, duplicate keys return null instead of a second job.
const enqueue = body('jarvis_enqueue_job')
assert.match(enqueue, /payload_hash is required/)
assert.match(enqueue, /idempotency_key is required/)
assert.match(enqueue, /if auth\.role\(\) = 'service_role'/)
assert.match(enqueue, /not exists \(select 1 from public\.workspaces where id = p_workspace_id\)/)
assert.match(enqueue, /not public\.is_workspace_member\(p_workspace_id\)/)
assert.match(enqueue, /where id = p_claim_id and workspace_id = p_workspace_id/)
assert.match(enqueue, /claim is disabled/)
assert.match(enqueue, /adjuster disabled for workspace/)
assert.match(enqueue, /on conflict \(workspace_id, idempotency_key\) do nothing/)

// Enrollment: server-supplied identity only, lead must be in the workspace,
// and an existing lead is reused rather than duplicated.
const enroll = body('adjuster_enroll_claim')
assert.match(enroll, /identity_id must be a UUID or empty/)
assert.match(enroll, /where id = p_lead_id and workspace_id = p_workspace_id/)
assert.match(enroll, /on conflict \(workspace_id, lead_id\) do update/)

// Inbound: service role only, workspace-bound, stop-controlled, correlated to
// the specific claim lead, and message + job written in one transaction.
const inbound = body('adjuster_record_inbound')
assert.match(inbound, /auth\.role\(\) <> 'service_role'/)
assert.match(inbound, /where id = p_claim_id and workspace_id = p_workspace_id\s+for update/)
assert.match(inbound, /target_claim\.lead_id is distinct from p_matched_lead_id/)
assert.match(inbound, /sender does not match the claim lead/)
assert.match(inbound, /insert into public\.adjuster_messages/)
assert.match(inbound, /insert into public\.jarvis_jobs/)
assert.ok(inbound.indexOf('insert into public.adjuster_messages') < inbound.indexOf('insert into public.jarvis_jobs'))
assert.match(inbound, /'run_claim_plan'/)

// Stop controls cancel queued work in the same transaction as the flag write.
for (const [name, predicate] of [
  ['adjuster_set_claim_disabled', /where claim_id = p_claim_id and status = 'queued'/],
  ['adjuster_set_workspace_enabled', /where workspace_id = p_workspace_id and status = 'queued'/],
]) {
  const text = body(name)
  assert.match(text, /set status = 'cancelled'/)
  assert.match(text, predicate)
}

// Auto-enroll every new lead and backfill the existing ones exactly once.
assert.match(sql, /create or replace function public\.adjuster_auto_enroll_lead\(\)/)
assert.match(sql, /drop trigger if exists adjuster_leads_auto_enroll on public\.leads/)
assert.match(sql, /after insert on public\.leads/)
assert.match(sql, /on conflict \(workspace_id, lead_id\) do nothing;/)
assert.ok(sql.indexOf('insert into public.adjuster_claims (workspace_id, lead_id, identity_id)\n  select') > -1)

// Grants: clients execute RPCs; only the worker can record inbound messages.
assert.match(sql, /grant execute on function public\.jarvis_enqueue_job/)
assert.match(sql, /grant execute on function public\.adjuster_enroll_claim/)
assert.match(sql, /grant execute on function public\.adjuster_record_inbound[\s\S]*?to service_role/)

// Adapters must use those RPCs, with no direct client-side claim writes.
assert.match(adapter, /rpc\('adjuster_enroll_claim'/)
assert.match(adapter, /rpc\('jarvis_enqueue_job'/)
assert.match(adapter, /rpc\('adjuster_record_inbound'/)
assert.doesNotMatch(adapter, /\.from\('adjuster_claims'\)\s*\.insert/)
assert.doesNotMatch(adapter, /\.from\('jarvis_jobs'\)\s*\.insert/)
assert.doesNotMatch(claimsRoute, /body\.identityId/)
assert.match(claimsRoute, /process\.env\.JARVIS_ADJUSTER_IDENTITY_ID/)
assert.match(inboundRoute, /claimLeadId: claim\.lead_id/)
assert.match(settingsRoute, /adjuster_set_workspace_enabled|disableDecision/)
assert.match(workerRoute, /runJobWithPolicies/)
assert.match(workerRoute, /settings\?\.disabled|claim\.disabled/)

console.log('jarvis-adjuster migration and adapter contract passed')
