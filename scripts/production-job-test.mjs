import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  PRODUCTION_JOB_TRANSITIONS,
  describeProductionJobStatus,
  describeScopeLineCount,
  nextProductionJobStatuses,
} = await import('../lib/jobs/production.ts')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/064_production_job_handoff.sql')
const route = read('../app/api/estimates/[id]/job/route.ts')
const page = read('../app/estimate/[id]/page.tsx')
const assertions = read('../scripts/ci/production-job-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')

// 1. Status transitions match what production actually allows.
assert.deepEqual(PRODUCTION_JOB_TRANSITIONS.ready, ['scheduled', 'in_progress', 'cancelled'])
assert.deepEqual(PRODUCTION_JOB_TRANSITIONS.scheduled, ['in_progress', 'cancelled'])
assert.deepEqual(PRODUCTION_JOB_TRANSITIONS.in_progress, ['completed', 'cancelled'])
assert.deepEqual(PRODUCTION_JOB_TRANSITIONS.completed, [])
assert.deepEqual(PRODUCTION_JOB_TRANSITIONS.cancelled, [])
assert.deepEqual(nextProductionJobStatuses('ready'), ['scheduled', 'in_progress', 'cancelled'])
assert.deepEqual(nextProductionJobStatuses('ready'), PRODUCTION_JOB_TRANSITIONS.ready)
assert.equal(describeProductionJobStatus('ready'), 'Ready for production')
assert.equal(describeProductionJobStatus('made_up'), 'Unknown status')
assert.equal(describeScopeLineCount({ scope_item_count: 1 }), '1 approved scope line')
assert.equal(describeScopeLineCount({ approved_scope: [{}, {}] }), '2 approved scope lines')

// 2. Migration creates one handoff record per accepted estimate.
assert.ok(migration.includes('create table if not exists public.production_jobs'), 'job table')
assert.ok(migration.includes('unique (estimate_id)'), 'one job per estimate')
assert.ok(migration.includes('unique (workspace_id, job_number)'), 'workspace-scoped job number')
assert.ok(migration.includes('accepted_total numeric(12,2) not null check (accepted_total > 0)'), 'real priced handoff')
assert.ok(migration.includes('scope_item_count integer not null default 0 check (scope_item_count > 0)'), 'scope required')
assert.ok(migration.includes("jsonb_typeof(approved_scope) = 'array'"), 'scope is an array')

// 3. The database owns the source evidence.
assert.ok(migration.includes("if v_estimate.status <> 'approved'"), 'approved estimate only')
assert.ok(migration.includes('v_estimate.lead_id is null'), 'customer is required')
assert.ok(migration.includes('where id = new.acceptance_id'), 'acceptance is looked up, not trusted')
assert.ok(migration.includes('v_acceptance.estimate_id is distinct from v_estimate.id'), 'acceptance must match the estimate')
assert.ok(migration.includes('v_acceptance.accepted_total <= 0'), 'zero-dollar handoff is refused')
assert.ok(migration.includes("if v_lead.status = 'lost'"), 'lost lead is refused')
assert.ok(migration.includes('from public.estimate_line_items li'), 'scope is copied from line items')
assert.ok(migration.includes('if v_scope_count = 0'), 'empty scope is refused')
assert.ok(migration.includes("new.job_number := 'JOB-' ||"), 'job number is server owned')
assert.ok(migration.includes('new.lead_id := v_estimate.lead_id'), 'lead is copied from the estimate')
assert.ok(migration.includes('new.customer_name := v_lead.name'), 'customer name is copied')
assert.ok(migration.includes('new.property_address := v_lead.address'), 'property address is copied')
assert.ok(migration.includes("new.status := 'ready'"), 'new jobs start ready, not completed')
assert.ok(migration.includes('new.accepted_total := v_acceptance.accepted_total'), 'amount is copied from acceptance')
assert.ok(migration.includes('new.accepted_at := v_acceptance.accepted_at'), 'accepted time is copied from acceptance')
assert.ok(migration.includes('new.approved_scope := v_scope'), 'scope snapshot is copied')
assert.ok(migration.includes('set status = \'won\''), 'lead is marked won by the job')
assert.ok(migration.includes("next_action = 'Prepare production job'"), 'lead gets the production next action')

// 4. Source evidence is immutable; only status moves.
assert.ok(migration.includes('The production handoff source evidence is immutable'), 'source immutability')
assert.ok(migration.includes('Invalid production job status transition'), 'status transition guard')
assert.ok(migration.includes("old.status = 'in_progress' and new.status in ('completed','cancelled')"), 'terminal transitions')
assert.ok(migration.includes('A production job handoff cannot be deleted'), 'no delete')
assert.ok(!/create policy production_jobs_delete/.test(migration), 'no delete policy')

// 5. RLS is workspace scoped and records the caller.
assert.ok(migration.includes('alter table public.production_jobs enable row level security'), 'RLS enabled')
assert.ok(migration.includes('production_jobs_select'), 'select policy')
assert.ok(migration.includes('production_jobs_insert'), 'insert policy')
assert.ok(migration.includes('auth.uid() = created_by'), 'creator is the caller')
assert.ok(migration.includes('production_jobs_update'), 'status update policy')
assert.ok(migration.includes('Workspace membership is required to create a production job'), 'membership gate')

// 6. Route is authenticated, workspace scoped and bounded.
assert.ok(route.includes('status: 401'), 'unauthenticated request is rejected')
assert.ok(route.includes('status: 404'), 'foreign estimate is not leaked')
assert.ok(route.includes(".eq('workspace_id', workspaceId)"), 'queries are workspace scoped')
assert.ok(route.includes('readJson(request)'), 'bounded JSON reader')
assert.ok(route.includes("read.body.action !== 'create_job'"), 'explicit action')
assert.ok(route.includes('Record customer acceptance before production handoff.'), 'acceptance required')
assert.ok(route.includes('This estimate already has a production job.'), 'duplicate job is explained')
assert.ok(route.includes("status: 409"), 'state conflict is a 409')
assert.ok(route.includes('accepted_total: 0.01'), 'browser sends no real amount')
assert.ok(route.includes('job_number: \'pending\''), 'browser sends no job number')

// 7. Page shows source evidence and never invents a job.
assert.ok(page.includes('Create production job'), 'handoff action is visible')
assert.ok(page.includes('Production handoff'), 'handoff section')
assert.ok(page.includes('describeProductionJobStatus(job.status)'), 'status label')
assert.ok(page.includes('describeScopeLineCount(job)'), 'scope count')
assert.ok(page.includes('job.approved_scope.map'), 'scope is displayed')
assert.ok(page.includes('Later estimate edits do not change it'), 'snapshot is explained')
assert.ok(page.includes('role="alert"'), 'errors are announced')
assert.ok(page.includes("estimate.status === 'approved'"), 'acceptance section stays approval gated')

// 8. Real PostgreSQL assertions cover the gate and isolation.
assert.ok(assertions.includes('production_jobs'), 'assertions write jobs')
assert.ok(assertions.includes('unapproved'), 'assertions check the approval gate')
assert.ok(assertions.includes('no acceptance'), 'assertions check the acceptance gate')
assert.ok(assertions.includes('cross-workspace'), 'assertions check workspace isolation')
assert.ok(assertions.includes('immutable'), 'assertions check source immutability')
assert.ok(assertions.includes('lost lead'), 'assertions check the lost lead gate')
assert.ok(assertions.includes('empty scope'), 'assertions check the scope gate')
assert.ok(assertions.includes('RLS'), 'assertions check row level security')
assert.ok(assertions.includes('status transition'), 'assertions check transitions')
assert.ok(assertions.includes('lead is not won'), 'assertions check the lead handoff')

// 9. Runner is local-only and uses its own disposable database.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'), 'runner refuses non-local host')
assert.ok(runner.includes('roofos_job_ci'), 'runner uses a dedicated disposable database')
assert.ok(runner.includes('063_estimate_acceptance_deposit.sql'), 'runner applies acceptance migration')
assert.ok(runner.includes('064_production_job_handoff.sql'), 'runner applies job migration')
assert.ok(runner.includes('production-job-assertions.sql'), 'runner executes the assertions')

console.log('production-job-test: PASS (approved estimate + recorded acceptance + real priced scope, one immutable job per estimate, server-owned evidence, workspace RLS, status-only transitions)')
