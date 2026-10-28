import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  PERMIT_STATUSES,
  WEATHER_DECISIONS,
  WEATHER_FRESHNESS_MS,
  describePermitStatus,
  describeWeatherDecision,
  evaluatePrebuildReadiness,
} = await import('../lib/jobs/readiness.ts')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/068_production_job_readiness.sql')
const route = read('../app/api/production-jobs/[id]/readiness/route.ts')
const detailPage = read('../app/jobs/[id]/page.tsx')
const assertions = read('../scripts/ci/production-job-readiness-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')

const NOW = Date.parse('2026-11-17T15:00:00.000Z')
const freshStamp = new Date(NOW - 60 * 60 * 1000).toISOString()
const staleStamp = new Date(NOW - 30 * 60 * 60 * 1000).toISOString()

const job = { acceptance_id: 'ac100000-0000-4000-8000-000000000001', accepted_total: 18450.5, scope_item_count: 3 }
const received = { status: 'received', problem: null }
const crew = [
  { status: 'scheduled', role: 'crew_lead' },
  { status: 'confirmed', role: 'crew' },
]
const materials = [{ status: 'ordered' }, { status: 'delivered' }]
const record = {
  permit_status: 'issued',
  permit_reference: 'PRM-2026-0042',
  permit_checked_at: freshStamp,
  weather_decision: 'clear',
  weather_source: 'Owner checked NWS forecast',
  weather_checked_at: freshStamp,
}

const full = { job, deposit: received, assignments: crew, materials, record }

// 1. Vocabulary and labels.
assert.deepEqual([...PERMIT_STATUSES], ['unknown', 'not_required', 'needed', 'applied', 'issued'])
assert.deepEqual([...WEATHER_DECISIONS], ['unknown', 'clear', 'hold'])
assert.equal(WEATHER_FRESHNESS_MS, 24 * 60 * 60 * 1000)
assert.equal(describePermitStatus('not_required'), 'No permit required')
assert.equal(describePermitStatus('issued'), 'Permit issued')
assert.equal(describePermitStatus('made_up'), 'Permit not checked')
assert.equal(describeWeatherDecision('clear'), 'Weather clear')
assert.equal(describeWeatherDecision('hold'), 'Weather hold')
assert.equal(describeWeatherDecision('made_up'), 'Weather not checked')

// 2. All six checklist items are present, in a stable order.
const allSix = evaluatePrebuildReadiness(full, NOW)
assert.deepEqual(
  allSix.checks.map((check) => check.key),
  ['approved_work_order', 'deposit', 'crew', 'materials', 'permit', 'weather'],
)
assert.equal(allSix.ready, true)
assert.deepEqual(allSix.blockers, [])
assert.equal(allSix.deposit_status, 'received')
assert.equal(allSix.permit_status, 'issued')
assert.equal(allSix.weather_decision, 'clear')
assert.equal(allSix.weather_age_hours, 1)

// 3. Every blocked item is reported, and readiness is only the absence of blockers.
const missing = evaluatePrebuildReadiness(
  {
    job: { acceptance_id: '', accepted_total: 0, scope_item_count: 0 },
    deposit: { status: 'none', problem: null },
    assignments: [],
    materials: [],
    record: null,
  },
  NOW,
)
assert.equal(missing.ready, false)
assert.deepEqual(missing.blockers, [
  'Approved work order',
  'Deposit',
  'Crew',
  'Materials',
  'Permit',
  'Weather',
])
assert.equal(missing.weather_age_hours, null)
assert.ok(missing.note.includes('not proof that Gate 3 is closed'))
assert.ok(missing.note.includes('does not contact a permit office'), 'the note states no external contact')

// 4. Deposit readiness: only received or waived, and never with a ledger problem.
assert.equal(evaluatePrebuildReadiness({ ...full, deposit: { status: 'waived', problem: null } }, NOW).ready, true)
assert.equal(evaluatePrebuildReadiness({ ...full, deposit: { status: 'requested', problem: null } }, NOW).ready, false)
assert.equal(evaluatePrebuildReadiness({ ...full, deposit: { status: 'refunded', problem: null } }, NOW).ready, false)
const conflicted = evaluatePrebuildReadiness(
  { ...full, deposit: { status: 'received', problem: 'A deposit can only be received after it is requested.' } },
  NOW,
)
assert.equal(conflicted.ready, false)
assert.ok(conflicted.blockers.includes('Deposit'))

// 5. Crew readiness needs an active assignment and a crew lead.
assert.equal(
  evaluatePrebuildReadiness({ ...full, assignments: [{ status: 'scheduled', role: 'crew' }] }, NOW).ready,
  false,
)
assert.equal(
  evaluatePrebuildReadiness({ ...full, assignments: [{ status: 'cancelled', role: 'crew_lead' }] }, NOW).ready,
  false,
)
assert.equal(
  evaluatePrebuildReadiness({ ...full, assignments: [{ status: 'confirmed', role: 'crew_lead' }] }, NOW).ready,
  true,
)

// 6. Materials readiness needs at least one active line and zero still needed.
assert.equal(evaluatePrebuildReadiness({ ...full, materials: [] }, NOW).ready, false)
assert.equal(evaluatePrebuildReadiness({ ...full, materials: [{ status: 'needed' }] }, NOW).ready, false)
assert.equal(
  evaluatePrebuildReadiness({ ...full, materials: [{ status: 'needed' }, { status: 'cancelled' }] }, NOW).ready,
  false,
  'a cancelled line does not disguise a needed line',
)
assert.equal(
  evaluatePrebuildReadiness({ ...full, materials: [{ status: 'delivered' }, { status: 'cancelled' }] }, NOW).ready,
  true,
)

// 7. Permit readiness needs a server-stamped decision of issued or not required.
assert.equal(evaluatePrebuildReadiness({ ...full, record: null }, NOW).ready, false)
assert.equal(
  evaluatePrebuildReadiness({ ...full, record: { ...record, permit_status: 'applied' } }, NOW).ready,
  false,
)
assert.equal(
  evaluatePrebuildReadiness({ ...full, record: { ...record, permit_status: 'needed' } }, NOW).ready,
  false,
)
assert.equal(
  evaluatePrebuildReadiness({ ...full, record: { ...record, permit_status: 'issued', permit_checked_at: null } }, NOW).ready,
  false,
  'an issued permit without a server stamp is not evidence',
)
assert.equal(
  evaluatePrebuildReadiness({ ...full, record: { ...record, permit_status: 'not_required' } }, NOW).ready,
  true,
)

// 8. Weather readiness needs clear weather, a server stamp, and 24 hours of freshness.
assert.equal(evaluatePrebuildReadiness({ ...full, record: { ...record, weather_decision: 'hold' } }, NOW).ready, false)
assert.equal(
  evaluatePrebuildReadiness({ ...full, record: { ...record, weather_decision: 'clear', weather_checked_at: null } }, NOW).ready,
  false,
)
const stale = evaluatePrebuildReadiness(
  { ...full, record: { ...record, weather_checked_at: staleStamp } },
  NOW,
)
assert.equal(stale.ready, false)
assert.ok(stale.blockers.includes('Weather'))
assert.equal(stale.weather_age_hours, 30)
assert.ok(stale.checks.find((check) => check.key === 'weather').detail.includes('older than 24 hours'))

// Boundary: exactly 24 hours is still fresh; one millisecond more is stale.
const exactly = evaluatePrebuildReadiness(
  { ...full, record: { ...record, weather_checked_at: new Date(NOW - WEATHER_FRESHNESS_MS).toISOString() } },
  NOW,
)
assert.equal(exactly.ready, true)
const justStale = evaluatePrebuildReadiness(
  { ...full, record: { ...record, weather_checked_at: new Date(NOW - WEATHER_FRESHNESS_MS - 1).toISOString() } },
  NOW,
)
assert.equal(justStale.ready, false)

// A future timestamp is clamped to zero age rather than becoming negative.
const future = evaluatePrebuildReadiness(
  { ...full, record: { ...record, weather_checked_at: new Date(NOW + 60 * 60 * 1000).toISOString() } },
  NOW,
)
assert.equal(future.weather_age_hours, 0)

// An unparsable timestamp is treated as no evidence, not as fresh.
assert.equal(
  evaluatePrebuildReadiness({ ...full, record: { ...record, weather_checked_at: 'not-a-date' } }, NOW).ready,
  false,
)

// 9. The checklist is pure: no clock, no network, no mutation of its input.
const inputCopy = JSON.parse(JSON.stringify(full))
evaluatePrebuildReadiness(full, NOW)
assert.deepEqual(full, inputCopy, 'the evaluator never mutates its input')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(read('../lib/jobs/readiness.ts')))

// 10. Migration 068 stores decisions only and stamps who checked.
assert.ok(migration.includes('create table if not exists public.production_job_readiness'))
assert.ok(migration.includes('alter table public.production_job_readiness enable row level security'))
assert.ok(migration.includes('public.is_workspace_member(workspace_id)'), 'members read')
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'), 'admins write')
assert.ok(!/for delete/.test(migration), 'no delete policy exists')
assert.ok(migration.includes('A prebuild readiness record cannot be deleted; record a new decision instead'))
assert.ok(migration.includes('The readiness job and workspace are immutable'))
assert.ok(migration.includes('new.permit_checked_at := now()'))
assert.ok(migration.includes('new.permit_checked_by := auth.uid()'))
assert.ok(migration.includes('new.weather_checked_at := now()'))
assert.ok(migration.includes('new.weather_checked_by := auth.uid()'))
assert.ok(migration.includes('job_id uuid not null unique'), 'one readiness row per job')
assert.ok(!migration.includes('is_ready'), 'readiness is computed on read, not stored')
assert.ok(!/update public\.production_jobs|estimate_deposit_events|production_job_assignments|production_job_materials/.test(migration),
  'the migration never writes another ledger')
assert.ok(!/https?:\/\/|http_get|pg_net/.test(migration), 'no external call from the database')

// 11. Route is authenticated, admin gated, and read-only toward other ledgers.
for (const fragment of [
  'status: 400',
  'status: 401',
  'status: 403',
  'status: 404',
  'status: 409',
  'requireWorkspaceMember',
  'readJson(request, 8 * 1024)',
  '.eq(\'workspace_id\', workspaceId)',
  'deriveDepositState(job.accepted_total, events)',
  'evaluatePrebuildReadiness({',
  'is_workspace_admin',
  'A completed or cancelled job cannot record readiness.',
]) {
  assert.ok(route.includes(fragment), `route contains ${fragment}`)
}
assert.ok(route.includes("body.action === 'set_permit'"))
assert.ok(route.includes("body.action === 'set_weather'"))
assert.ok(route.includes('PERMIT_STATUSES.includes'))
assert.ok(route.includes('WEATHER_DECISIONS.includes'))
assert.ok(!/\.update\(\{[\s\S]{0,160}(accepted_total|approved_scope|customer_name|job_number|status)/.test(route),
  'the route never edits handoff evidence')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(route), 'the route performs no outbound call')
assert.ok(!/stripe|twilio|resend|sendgrid/i.test(route), 'no payment, message, or email path')
assert.ok(!/delete\(\)|\.delete\(/.test(route), 'no delete path')

// 12. The job page shows the checklist and never claims the gate is closed.
assert.ok(detailPage.includes('Prebuild readiness'))
assert.ok(detailPage.includes('/readiness`'))
assert.ok(detailPage.includes('prebuild.readiness.blockers.length'))
assert.ok(detailPage.includes('Record permit decision'))
assert.ok(detailPage.includes('Record weather decision'))
assert.ok(detailPage.includes('PERMIT_STATUSES.map'))
assert.ok(detailPage.includes('WEATHER_DECISIONS.map'))
assert.ok(detailPage.includes('Clear weather is stale after 24 hours'))
assert.ok(detailPage.includes('weather_age_hours.toFixed(1)'), 'the fraction is shown consistently')
assert.ok(detailPage.includes('not a live permit-office or weather-provider check'))
assert.ok(!/Gate 3 (is )?closed|insurer (will|approved)|guarantee/i.test(detailPage))

// 13. Real PostgreSQL assertions cover the guards.
for (const marker of [
  'a plain member recorded readiness',
  'unknown decisions must not carry a check time',
  'permit decision was not stamped by the database',
  'weather decision was not stamped by the database',
  'a reference edit restamped the permit checker',
  'unknown permit kept a check stamp',
  'an unsupported permit status was accepted',
  'a second readiness row was accepted for one job',
  'readiness was moved to another job',
  'a readiness row was deleted',
  'another workspace recorded readiness',
  'outsider saw % readiness rows',
  'readiness work changed the handoff',
  "member saw % readiness rows, expected 1",
]) {
  assert.ok(assertions.includes(marker), `assertions cover: ${marker}`)
}

// 14. Runner stays local-only and applies 068 after 067.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'))
assert.ok(runner.includes('roofos_job_ci'))
assert.ok(runner.includes('067_production_job_schedule.sql'))
assert.ok(runner.includes('068_production_job_readiness.sql'))
assert.ok(
  runner.indexOf('068_production_job_readiness.sql') > runner.indexOf('067_production_job_schedule.sql'),
  'migration 068 is applied after 067',
)
assert.ok(runner.includes('production-job-readiness-assertions.sql'))

// 15. CI wiring.
const pkg = JSON.parse(read('../package.json'))
assert.equal(
  pkg.scripts['test:production-job-readiness'],
  'node --experimental-strip-types --no-warnings scripts/production-job-readiness-test.mjs',
)
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:production-job-readiness'))
assert.ok(ci.includes('068_production_job_readiness.sql'))

console.log('production-job-readiness-test: PASS (six-item prebuild checklist, deposit/crew/material evidence, server-stamped permit and weather decisions, 24h weather freshness, blockers reported, one row per job, no delete, no other ledger write, no external call, no Gate 3 claim, real PostgreSQL assertions, CI wiring)')
