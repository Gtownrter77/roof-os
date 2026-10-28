import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  PUNCH_SEVERITIES,
  PUNCH_STATUSES,
  describePunchSeverity,
  describePunchStatus,
  canResolvePunchItem,
  summarizePunch,
  evaluateCloseoutGate,
} = await import('../lib/jobs/qc.ts')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/070_qc_punch_closeout.sql')
const punchRoute = read('../app/api/production-jobs/[id]/punch-items/route.ts')
const closeoutRoute = read('../app/api/production-jobs/[id]/closeout/route.ts')
const statusRoute = read('../app/api/production-jobs/[id]/status/route.ts')
const detailPage = read('../app/jobs/[id]/page.tsx')
const assertions = read('../scripts/ci/production-job-qc-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')

// 1. Vocabulary is stable.
assert.deepEqual([...PUNCH_SEVERITIES], ['critical', 'major', 'minor'])
assert.deepEqual([...PUNCH_STATUSES], ['open', 'resolved'])
assert.equal(describePunchSeverity('critical'), 'Critical — blocks completion')
assert.equal(describePunchSeverity('major'), 'Major')
assert.equal(describePunchSeverity('minor'), 'Minor')
assert.equal(describePunchSeverity('made_up'), 'Unknown severity')
assert.equal(describePunchStatus('open'), 'Open')
assert.equal(describePunchStatus('resolved'), 'Resolved')
assert.equal(describePunchStatus('made_up'), 'Unknown status')

// 2. Only an open item can be resolved. There is no reopen path.
assert.equal(canResolvePunchItem('open'), true)
assert.equal(canResolvePunchItem('resolved'), false)
assert.equal(canResolvePunchItem('made_up'), false)

// 3. The summary counts severity for open items only.
const summary = summarizePunch([
  { severity: 'critical', status: 'open' },
  { severity: 'critical', status: 'resolved' },
  { severity: 'major', status: 'open' },
  { severity: 'minor', status: 'open' },
  { severity: 'minor', status: 'resolved' },
  { severity: 'major', status: 'resolved' },
])
assert.deepEqual(summary, {
  total: 6,
  open_total: 3,
  open_critical: 1,
  open_major: 1,
  open_minor: 1,
  resolved_total: 3,
})

const empty = summarizePunch([])
assert.deepEqual(empty, {
  total: 0,
  open_total: 0,
  open_critical: 0,
  open_major: 0,
  open_minor: 0,
  resolved_total: 0,
})

// Unknown severities still count as open work; they never invent a critical.
const unknown = summarizePunch([
  { severity: 'made_up', status: 'open' },
  { severity: null, status: 'open' },
  { severity: 'critical', status: null },
])
assert.equal(unknown.open_total, 2)
assert.equal(unknown.open_critical, 0)
assert.equal(unknown.resolved_total, 1)
assert.equal(unknown.total, 3)

// 4. The closeout gate is blocked only by open critical items.
const clear = evaluateCloseoutGate([
  { severity: 'minor', status: 'open' },
  { severity: 'major', status: 'open' },
  { severity: 'critical', status: 'resolved' },
])
assert.equal(clear.can_close, true, 'open minor and major items do not block')
assert.equal(clear.open_critical, 0)
assert.equal(clear.open_total, 2)
assert.deepEqual(clear.blockers, [])

const oneCritical = evaluateCloseoutGate([{ severity: 'critical', status: 'open' }])
assert.equal(oneCritical.can_close, false)
assert.equal(oneCritical.open_critical, 1)
assert.deepEqual(oneCritical.blockers, ['Resolve 1 critical punch item before closeout.'])

const twoCritical = evaluateCloseoutGate([
  { severity: 'critical', status: 'open' },
  { severity: 'critical', status: 'open' },
  { severity: 'minor', status: 'open' },
])
assert.equal(twoCritical.can_close, false)
assert.deepEqual(twoCritical.blockers, ['Resolve 2 critical punch items before closeout.'])

// Resolving the last critical item opens the gate without losing the open count.
const justOpened = evaluateCloseoutGate([
  { severity: 'critical', status: 'resolved' },
  { severity: 'minor', status: 'open' },
])
assert.equal(justOpened.can_close, true)
assert.equal(justOpened.open_total, 1)

// 5. Migration 070 stores QC evidence and never touches the handoff.
assert.ok(migration.includes('create table if not exists public.production_job_punch_items'))
assert.ok(migration.includes('create table if not exists public.production_job_closeouts'))
assert.ok(migration.includes('alter table public.production_job_punch_items enable row level security'))
assert.ok(migration.includes('alter table public.production_job_closeouts enable row level security'))
assert.ok(migration.includes('public.is_workspace_member(workspace_id)'), 'members read punch items')
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'), 'owners record closeouts')
assert.ok(!/for delete/.test(migration), 'no delete policy exists')
assert.ok(migration.includes('A punch item cannot be deleted; resolve it or record a new item'))
assert.ok(migration.includes('A resolved punch item is immutable'))
assert.ok(migration.includes('A punch item update must resolve the item'))
assert.ok(migration.includes('The punch item fields are immutable; only the resolution may change'))
assert.ok(migration.includes('A supervisor closeout cannot be deleted'))
assert.ok(migration.includes('A supervisor closeout is immutable'))
assert.ok(migration.includes('A supervisor closeout can only be recorded while the job is in progress'))
assert.ok(migration.includes('A supervisor closeout is blocked by % unresolved critical punch item(s)'))
assert.ok(migration.includes('A production job needs a supervisor closeout before completion'))
assert.ok(migration.includes('A production job cannot complete with unresolved critical punch items'))
assert.ok(migration.includes('A completed or cancelled job cannot take new punch items'))
assert.ok(migration.includes('A completed or cancelled job cannot resolve punch items'))
assert.ok(migration.includes("new.status := 'open'"), 'a new punch item cannot arrive resolved')
assert.ok(migration.includes('new.created_by := auth.uid()'), 'the punch author is the caller')
assert.ok(migration.includes('new.resolved_by := auth.uid()'), 'the resolver is the caller')
assert.ok(migration.includes('new.resolved_at := now()'), 'the resolution time is server side')
assert.ok(migration.includes('new.closed_by := auth.uid()'), 'the closeout supervisor is the caller')
assert.ok(migration.includes('new.closed_at := now()'), 'the closeout time is server side')
assert.ok(migration.includes('new.open_critical_count := v_critical'), 'the closeout counts are recomputed')
assert.ok(migration.includes('new.open_total_count := v_open'), 'the open total is recomputed')
assert.ok(migration.includes('constraint production_job_closeouts_one_per_job unique (job_id)'))
assert.ok(!/update\s+public\.production_jobs/i.test(migration), 'the migration never updates the handoff')
assert.ok(!/\baccepted_total\b\s*=|set\s+approved_scope/i.test(migration), 'no handoff field is written')
assert.ok(!/https?:\/\/|pg_net|http_get/.test(migration), 'no external call from the database')

// 6. Punch route is workspace scoped and never deletes.
for (const fragment of [
  'status: 400',
  'status: 401',
  'status: 404',
  'status: 409',
  'requireWorkspaceMember',
  'PUNCH_SEVERITIES',
  'canResolvePunchItem(current.status)',
  "body.action !== 'resolve'",
  'summarizePunch(rows)',
  'A completed or cancelled job cannot take new punch items.',
  'A completed or cancelled job cannot resolve punch items.',
  'This punch item is already resolved.',
]) {
  assert.ok(punchRoute.includes(fragment), `punch route contains ${fragment}`)
}
assert.ok(punchRoute.includes(".from('production_job_punch_items')"))
assert.ok(!/\.delete\(/.test(punchRoute), 'the punch route never deletes an item')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(punchRoute), 'the punch route performs no outbound call')
assert.ok(!/accepted_total|approved_scope/.test(punchRoute), 'the punch route never touches the handoff')

// 7. Closeout route is owner/admin only and stamps nothing from the client.
for (const fragment of [
  'status: 400',
  'status: 401',
  'status: 403',
  'status: 404',
  'status: 409',
  'requireWorkspaceMember',
  'is_workspace_admin',
  "job.status !== 'in_progress'",
  'evaluateCloseoutGate',
  'gate.can_close',
  'Workspace owner or administrator access is required to record a closeout.',
  'A supervisor closeout can only be recorded while the job is in progress.',
]) {
  assert.ok(closeoutRoute.includes(fragment), `closeout route contains ${fragment}`)
}
assert.ok(closeoutRoute.includes(".from('production_job_closeouts')"))
assert.ok(!/\.delete\(/.test(closeoutRoute), 'the route never deletes a closeout')
assert.ok(!/\.update\(/.test(closeoutRoute), 'the route never edits a closeout')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(closeoutRoute), 'the route performs no outbound call')
assert.ok(!/accepted_total|approved_scope/.test(closeoutRoute), 'the route never rewrites the handoff')
assert.ok(!/stripe|twilio|resend|sendgrid|mailto/i.test(closeoutRoute), 'no payment or customer contact path')

// 8. Status route delegates transitions and surfaces the closeout gate.
for (const fragment of [
  'status: 400',
  'status: 401',
  'status: 403',
  'status: 404',
  'requireWorkspaceMember',
  'is_workspace_admin',
  'nextProductionJobStatuses(job.status).includes(target)',
  'PRODUCTION_JOB_STATUSES',
]) {
  assert.ok(statusRoute.includes(fragment), `status route contains ${fragment}`)
}
assert.ok(!/accepted_total|approved_scope/.test(statusRoute), 'the status route never touches the handoff')

// 9. The page shows defects, closeout, status, and the boundary.
assert.ok(detailPage.includes('QC punch list'))
assert.ok(detailPage.includes('/punch-items`'))
assert.ok(detailPage.includes('/closeout`'))
assert.ok(detailPage.includes('/status`'))
assert.ok(detailPage.includes('Record punch item'))
assert.ok(detailPage.includes('Resolve punch item'))
assert.ok(detailPage.includes('Supervisor closeout'))
assert.ok(detailPage.includes('Record closeout'))
assert.ok(detailPage.includes('Move job status'))
assert.ok(detailPage.includes('describePunchSeverity'))
assert.ok(detailPage.includes('describePunchStatus'))
assert.ok(detailPage.includes('canResolvePunchItem'))
assert.ok(detailPage.includes('nextProductionJobStatuses'))
assert.ok(detailPage.includes('not a warranty'))
assert.ok(detailPage.includes('customer sign-off'))
assert.ok(!/insurer|submit to carrier|auto[- ]?send/i.test(detailPage))

// 10. Real PostgreSQL assertions cover the guards.
for (const marker of [
  'a new punch item must start open',
  'the punch author was not stamped from the caller',
  'a new punch item carried a forged resolution',
  'a plain member recorded a closeout',
  'a job completed without a supervisor closeout',
  'closeout succeeded with an open critical item',
  'the resolver was not stamped from the caller',
  'a resolved punch item was edited',
  'a resolved punch item was reopened',
  'a resolved punch item was resolved twice',
  'a punch item was deleted',
  'closeout succeeded with a second open critical item',
  'the closeout supervisor was not stamped from the caller',
  'the closeout critical count was not recomputed',
  'the closeout open count was not recomputed',
  'a second closeout was accepted for one job',
  'a closeout was rewritten',
  'a post-closeout critical item did not block completion',
  'a completed job took a new punch item',
  'a completed job resolved a punch item',
  'another workspace added a punch item',
  'another workspace recorded a closeout',
  'the punch trigger allowed an edit',
  'the punch trigger allowed a delete',
  'the closeout trigger allowed an edit',
  'the closeout trigger allowed a delete',
  'QC evidence changed the handoff amount or scope',
  'QC evidence changed the customer snapshot',
]) {
  assert.ok(assertions.includes(marker), `assertions cover: ${marker}`)
}

// 11. Runner stays local-only and applies 070 after 069.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'))
assert.ok(runner.includes('roofos_job_ci'))
assert.ok(runner.includes('070_qc_punch_closeout.sql'))
assert.ok(
  runner.indexOf('070_qc_punch_closeout.sql') > runner.indexOf('069_field_work_change_orders.sql'),
  'migration 070 is applied after 069',
)
assert.ok(runner.includes('production-job-qc-assertions.sql'))
assert.ok(
  runner.indexOf('production-job-qc-assertions.sql') > runner.indexOf('070_qc_punch_closeout.sql'),
  'the QC assertions run after migration 070',
)

// 12. CI wiring and migration-safety greps.
const pkg = JSON.parse(read('../package.json'))
assert.equal(
  pkg.scripts['test:production-job-qc'],
  'node --experimental-strip-types --no-warnings scripts/production-job-qc-test.mjs',
)
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:production-job-qc'))
assert.ok(ci.includes('070_qc_punch_closeout.sql'))
assert.ok(ci.includes('A production job needs a supervisor closeout before completion'))
assert.ok(ci.includes('A resolved punch item is immutable'))

console.log('production-job-qc-test: PASS (member punch items with server-stamped author and resolver, resolved-item immutability, no reopen, no delete, critical items block closeout, owner-only stamped closeout, one closeout per job, completion gate re-checks critical items, completed-job refusal, handoff snapshot untouched, real PostgreSQL assertions, CI wiring)')
