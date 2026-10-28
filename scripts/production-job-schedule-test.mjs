import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  ASSIGNMENT_ROLES,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TRANSITIONS,
  MATERIAL_STATUSES,
  MATERIAL_TRANSITIONS,
  describeAssignmentRole,
  describeAssignmentStatus,
  describeMaterialStatus,
  isValidScheduleWindow,
  nextAssignmentStatuses,
  nextMaterialStatuses,
  summarizeSchedule,
} = await import('../lib/jobs/schedule.ts')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/067_production_job_schedule.sql')
const route = read('../app/api/production-jobs/[id]/schedule/route.ts')
const listRoute = read('../app/api/production-jobs/route.ts')
const listPage = read('../app/jobs/page.tsx')
const detailPage = read('../app/jobs/[id]/page.tsx')
const estimatePage = read('../app/estimate/[id]/page.tsx')
const assertions = read('../scripts/ci/production-job-schedule-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')
const baseline = read('../scripts/ci/production-job-baseline.sql')

// 1. Status and role labels are stable.
assert.deepEqual(ASSIGNMENT_ROLES, ['crew_lead', 'crew', 'material_runner'])
assert.deepEqual(ASSIGNMENT_STATUSES, ['scheduled', 'confirmed', 'cancelled'])
assert.deepEqual(MATERIAL_STATUSES, ['needed', 'ordered', 'delivered', 'cancelled'])
assert.equal(describeAssignmentRole('crew_lead'), 'Crew lead')
assert.equal(describeAssignmentRole('made_up'), 'Unknown role')
assert.equal(describeAssignmentStatus('confirmed'), 'Confirmed')
assert.equal(describeMaterialStatus('delivered'), 'Delivered')
assert.equal(describeMaterialStatus('made_up'), 'Unknown status')

// 2. Transitions match the database triggers.
assert.deepEqual(ASSIGNMENT_TRANSITIONS.scheduled, ['confirmed', 'cancelled'])
assert.deepEqual(ASSIGNMENT_TRANSITIONS.confirmed, ['cancelled'])
assert.deepEqual(ASSIGNMENT_TRANSITIONS.cancelled, [])
assert.deepEqual(MATERIAL_TRANSITIONS.needed, ['ordered', 'cancelled'])
assert.deepEqual(MATERIAL_TRANSITIONS.ordered, ['delivered', 'cancelled'])
assert.deepEqual(MATERIAL_TRANSITIONS.delivered, [])
assert.deepEqual(nextAssignmentStatuses('scheduled'), ASSIGNMENT_TRANSITIONS.scheduled)
assert.deepEqual(nextAssignmentStatuses('made_up'), [])
assert.deepEqual(nextMaterialStatuses('ordered'), MATERIAL_TRANSITIONS.ordered)
assert.deepEqual(nextMaterialStatuses('made_up'), [])

// 3. Window validation rejects equal, inverted, and unparsable ranges.
assert.equal(isValidScheduleWindow('2026-11-02T08:00:00Z', '2026-11-02T17:00:00Z'), true)
assert.equal(isValidScheduleWindow('2026-11-02T17:00:00Z', '2026-11-02T08:00:00Z'), false)
assert.equal(isValidScheduleWindow('2026-11-02T08:00:00Z', '2026-11-02T08:00:00Z'), false)
assert.equal(isValidScheduleWindow('not-a-date', '2026-11-02T08:00:00Z'), false)

// 4. Readiness counts are planning signals only.
const readiness = summarizeSchedule(
  [
    { status: 'scheduled', role: 'crew_lead' },
    { status: 'confirmed', role: 'crew' },
    { status: 'cancelled', role: 'crew_lead' },
  ],
  [
    { status: 'needed' },
    { status: 'ordered' },
    { status: 'delivered' },
    { status: 'cancelled' },
  ],
)
assert.equal(readiness.assignments_total, 3)
assert.equal(readiness.assignments_active, 2)
assert.equal(readiness.crew_lead_assigned, true)
assert.equal(readiness.crew_scheduled, true)
assert.equal(readiness.materials_total, 3)
assert.equal(readiness.materials_needed, 1)
assert.equal(readiness.materials_ordered, 1)
assert.equal(readiness.materials_delivered_count, 1)
assert.equal(readiness.materials_all_delivered, false)

const empty = summarizeSchedule([], [])
assert.equal(empty.assignments_active, 0)
assert.equal(empty.crew_lead_assigned, false)
assert.equal(empty.crew_scheduled, false)
assert.equal(empty.materials_total, 0)
assert.equal(empty.materials_all_delivered, false, 'no materials means nothing is proven delivered')

const delivered = summarizeSchedule([{ status: 'scheduled', role: 'crew' }], [{ status: 'delivered' }])
assert.equal(delivered.materials_all_delivered, true)
assert.equal(delivered.crew_lead_assigned, false)

// 5. Migration keeps the schedule operational and append-only.
assert.ok(migration.includes('create table if not exists public.production_job_assignments'))
assert.ok(migration.includes('create table if not exists public.production_job_materials'))
assert.ok(migration.includes('alter table public.production_job_assignments enable row level security'))
assert.ok(migration.includes('alter table public.production_job_materials enable row level security'))
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'), 'writes are admin gated')
assert.ok(migration.includes('auth.uid() = created_by'), 'creator is the caller')
assert.ok(!/for delete/.test(migration), 'no delete policy exists')
assert.ok(migration.includes('A production assignment cannot be deleted; cancel it instead'))
assert.ok(migration.includes('A material line cannot be deleted; cancel it instead'))
assert.ok(migration.includes('The assignment source fields are immutable; change status or notes'))
assert.ok(migration.includes('The material source fields are immutable; change status, vendor, date or notes'))
assert.ok(migration.includes("new.status := 'scheduled'"), 'assignment status is server owned')
assert.ok(migration.includes("new.status := 'needed'"), 'material status is server owned')
assert.ok(migration.includes('The assigned person must belong to this workspace'))
assert.ok(migration.includes('A material line may only reference its own approved estimate scope'))
assert.ok(migration.includes('A production assignment must end after it starts'))
assert.ok(!/update public\.production_jobs/.test(migration), 'the handoff snapshot is never rewritten')
assert.ok(!migration.includes('accepted_total'), 'the migration never touches the accepted amount')
assert.ok(!migration.includes('approved_scope'), 'the migration never touches the approved scope')

// 6. Route is authenticated, workspace scoped, and admin gated for writes.
for (const fragment of [
  'status: 401',
  'status: 403',
  'status: 404',
  'requireWorkspaceMember',
  ".eq('workspace_id', workspaceId)",
  'readJson(request, 16 * 1024)',
]) {
  assert.ok(route.includes(fragment), `route contains ${fragment}`)
}
assert.ok(route.includes("is_workspace_admin"), 'route checks the admin role')
assert.ok(route.includes("body.action === 'add_assignment'"))
assert.ok(route.includes("body.action === 'add_material'"))
assert.ok(route.includes("body.action === 'set_assignment_status'"))
assert.ok(route.includes("body.action === 'set_material_status'"))
assert.ok(route.includes('A completed or cancelled job cannot take new schedule rows.'))
assert.ok(route.includes('nextAssignmentStatuses(current.status)'), 'route checks transitions before write')
assert.ok(route.includes('nextMaterialStatuses(current.status)'))
assert.ok(!/update\(\{[\s\S]{0,120}(accepted_total|approved_scope|customer_name|job_number)/.test(route), 'route never updates handoff evidence')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(route), 'route performs no outbound call')
assert.ok(route.includes('summarizeSchedule'), 'route returns planning readiness')

// 7. List route and pages are workspace scoped.
assert.ok(listRoute.includes("from('production_jobs')"))
assert.ok(listRoute.includes(".eq('workspace_id', workspaceId)"))
assert.ok(listRoute.includes('.limit(100)'))
assert.ok(listRoute.includes('requireWorkspaceMember'))
assert.ok(!/fetch\(|axios|https?:\/\//i.test(listRoute), 'list route performs no outbound call')

assert.ok(listPage.includes("fetch('/api/production-jobs'"))
assert.ok(listPage.includes('No production jobs yet'))
assert.ok(detailPage.includes('/schedule`'))
assert.ok(detailPage.includes('Add assignment'))
assert.ok(detailPage.includes('Add material line'))
assert.ok(detailPage.includes('planning signals only'))
assert.ok(detailPage.includes('never change the accepted customer, amount, scope, or warranty'))
assert.ok(!/make a payment|charge|purchase order created|crew confirmed for sure/i.test(detailPage), 'the page makes no money or commitment claim')
assert.ok(estimatePage.includes('/jobs/${job.id}'), 'the estimate handoff links to the schedule')

// 8. Real PostgreSQL assertions cover the important guards.
for (const marker of [
  'a plain member added a crew assignment',
  'a plain member added a material line',
  'an outsider was assigned to the crew',
  'an inverted assignment window was accepted',
  'an assignment source field was updated',
  'confirmed assignment moved back to scheduled',
  'an assignment was deleted',
  'a material line used another estimate',
  'material quantity was edited',
  'delivered material moved back to needed',
  'a material line was deleted',
  'another workspace attached an assignment',
  'schedule work changed the accepted amount',
  'schedule work changed the scope count',
  'schedule work changed the customer snapshot',
]) {
  assert.ok(assertions.includes(marker), `assertions cover: ${marker}`)
}

// 9. Runner stays local-only, applies 067, and uses a dedicated database.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'))
assert.ok(runner.includes('roofos_job_ci'))
assert.ok(runner.includes('067_production_job_schedule.sql'))
assert.ok(runner.includes('production-job-schedule-assertions.sql'))
assert.ok(baseline.includes('is_workspace_admin'), 'the disposable baseline provides the admin helper')

// 10. CI wiring.
const pkg = JSON.parse(read('../package.json'))
assert.equal(
  pkg.scripts['test:production-job-schedule'],
  'node --experimental-strip-types --no-warnings scripts/production-job-schedule-test.mjs',
)
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:production-job-schedule'))
assert.ok(ci.includes('067_production_job_schedule.sql'))

console.log('production-job-schedule-test: PASS (owner-only crew/material writes, member reads, no delete, status-only transitions, approved-scope links, handoff snapshot untouched, planning readiness, real PostgreSQL assertions, CI wiring)')
