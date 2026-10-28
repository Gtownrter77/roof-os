import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  CHANGE_ORDER_STATUSES,
  CHANGE_ORDER_DECISIONS,
  describeChangeOrderStatus,
  describeAmountDelta,
  isValidWorkDate,
  nextChangeOrderDecisions,
  summarizeChangeOrders,
} = await import('../lib/jobs/fieldwork.ts')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/069_field_work_change_orders.sql')
const updatesRoute = read('../app/api/production-jobs/[id]/updates/route.ts')
const changeOrderRoute = read('../app/api/production-jobs/[id]/change-orders/route.ts')
const detailPage = read('../app/jobs/[id]/page.tsx')
const assertions = read('../scripts/ci/production-job-fieldwork-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')

// 1. Vocabulary is stable.
assert.deepEqual([...CHANGE_ORDER_STATUSES], ['requested', 'approved', 'declined'])
assert.deepEqual([...CHANGE_ORDER_DECISIONS], ['approved', 'declined'])
assert.equal(describeChangeOrderStatus('requested'), 'Awaiting owner review')
assert.equal(describeChangeOrderStatus('approved'), 'Approved')
assert.equal(describeChangeOrderStatus('declined'), 'Declined')
assert.equal(describeChangeOrderStatus('made_up'), 'Unknown status')
assert.deepEqual(nextChangeOrderDecisions('requested'), ['approved', 'declined'])
assert.deepEqual(nextChangeOrderDecisions('approved'), [])
assert.deepEqual(nextChangeOrderDecisions('declined'), [])
assert.deepEqual(nextChangeOrderDecisions('made_up'), [])

// 2. A work date must be a real calendar date and never in the future.
const TODAY = '2026-11-18'
assert.equal(isValidWorkDate('2026-11-18', TODAY), true)
assert.equal(isValidWorkDate('2026-11-17', TODAY), true)
assert.equal(isValidWorkDate('2026-11-19', TODAY), false, 'future date is refused')
assert.equal(isValidWorkDate('2024-02-29', TODAY), true, 'leap day is valid')
assert.equal(isValidWorkDate('2026-02-29', TODAY), false, 'non-leap February 29 is refused')
assert.equal(isValidWorkDate('2026-02-30', TODAY), false)
assert.equal(isValidWorkDate('2026-13-01', TODAY), false)
assert.equal(isValidWorkDate('18-11-2026', TODAY), false)
assert.equal(isValidWorkDate('', TODAY), false)
assert.equal(isValidWorkDate(null, TODAY), false)
assert.equal(isValidWorkDate(20261118, TODAY), false)
assert.equal(isValidWorkDate('2026-11-18', 'not-a-date'), false)

// 3. Only approved deltas count toward invoice input.
const summary = summarizeChangeOrders([
  { status: 'approved', amount_delta: '1250.00' },
  { status: 'approved', amount_delta: -250 },
  { status: 'requested', amount_delta: 900 },
  { status: 'requested', amount_delta: '100.50' },
  { status: 'declined', amount_delta: 5000 },
])
assert.equal(summary.approved_count, 2)
assert.equal(summary.requested_count, 2)
assert.equal(summary.declined_count, 1)
assert.equal(summary.approved_delta_total, 1000)
assert.equal(summary.requested_delta_total, 1000.5)
assert.equal(summary.has_pending, true)

const none = summarizeChangeOrders([])
assert.deepEqual(none, {
  requested_count: 0,
  approved_count: 0,
  declined_count: 0,
  approved_delta_total: 0,
  requested_delta_total: 0,
  has_pending: false,
})

const onlyDeclined = summarizeChangeOrders([{ status: 'declined', amount_delta: 400 }])
assert.equal(onlyDeclined.approved_delta_total, 0, 'a declined request never adds money')
assert.equal(onlyDeclined.has_pending, false)

const pendingOnly = summarizeChangeOrders([{ status: 'requested', amount_delta: 300 }])
assert.equal(pendingOnly.approved_delta_total, 0, 'a pending request is not invoiced')
assert.equal(pendingOnly.requested_delta_total, 300)
assert.equal(pendingOnly.has_pending, true)

// Unknown statuses and bad amounts never invent money.
const unknown = summarizeChangeOrders([
  { status: 'made_up', amount_delta: 700 },
  { status: 'approved', amount_delta: 'not-a-number' },
  { status: 'approved', amount_delta: null },
])
assert.equal(unknown.approved_count, 2)
assert.equal(unknown.approved_delta_total, 0)
assert.equal(unknown.requested_count, 0)
assert.equal(unknown.declined_count, 0)

// Rounding keeps cents stable.
const cents = summarizeChangeOrders([
  { status: 'approved', amount_delta: 0.1 },
  { status: 'approved', amount_delta: 0.2 },
])
assert.equal(cents.approved_delta_total, 0.3)

// 4. Signed labels never hide a credit.
assert.equal(describeAmountDelta(1250), '+$1,250.00')
assert.equal(describeAmountDelta('-250.5'), '-$250.50')
assert.equal(describeAmountDelta(0), '$0.00')
assert.ok(describeAmountDelta(-0.01).startsWith('-$0.01'), 'a one-cent credit keeps its sign')

// 5. Migration 069 stores evidence and decisions, never the handoff.
assert.ok(migration.includes('create table if not exists public.production_job_updates'))
assert.ok(migration.includes('create table if not exists public.production_job_change_orders'))
assert.ok(migration.includes('alter table public.production_job_updates enable row level security'))
assert.ok(migration.includes('alter table public.production_job_change_orders enable row level security'))
assert.ok(migration.includes('public.is_workspace_member(workspace_id)'), 'members read and request')
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'), 'admins decide')
assert.ok(!/for delete/.test(migration), 'no delete policy exists')
assert.ok(migration.includes('A field update cannot be deleted; add a correcting update instead'))
assert.ok(migration.includes('A field update is append-only; add a correcting update instead'))
assert.ok(migration.includes('A completed or cancelled job cannot take new field updates'))
assert.ok(migration.includes('A field update cannot be dated in the future'))
assert.ok(migration.includes('A change order cannot be deleted; decline it instead'))
assert.ok(migration.includes('A decided change order is immutable'))
assert.ok(migration.includes('The change order request fields are immutable; only the decision may change'))
assert.ok(migration.includes('A completed or cancelled job cannot take a new change order'))
assert.ok(migration.includes("new.status := 'requested'"), 'a new request cannot arrive pre-approved')
assert.ok(migration.includes('new.requested_by := auth.uid()'), 'the requester is the caller')
assert.ok(migration.includes('new.decided_by := auth.uid()'), 'the decider is the caller')
assert.ok(migration.includes('new.decided_at := now()'), 'the decision time is server side')
assert.ok(migration.includes('amount_delta <> 0'), 'a zero change order is refused')
assert.ok(migration.includes('percent_complete between 0 and 100'))
assert.ok(!/update\s+public\.production_jobs/i.test(migration), 'the migration never updates the handoff')
assert.ok(!/\baccepted_total\b\s*=|set\s+approved_scope/i.test(migration), 'no handoff field is written')
assert.ok(migration.includes('never rewrites the handoff approved_scope'), 'the comment states the boundary')
assert.ok(!/https?:\/\/|pg_net|http_get/.test(migration), 'no external call from the database')

// 6. Updates route is append-only and workspace scoped.
for (const fragment of [
  'status: 400',
  'status: 401',
  'status: 404',
  'status: 409',
  'requireWorkspaceMember',
  'readJson(request, 16 * 1024)',
  ".eq('workspace_id', workspaceId)",
  'isValidWorkDate(body.work_date, today)',
  'A completed or cancelled job cannot take new field updates.',
]) {
  assert.ok(updatesRoute.includes(fragment), `updates route contains ${fragment}`)
}
assert.ok(updatesRoute.includes(".from('production_job_updates')"))
assert.ok(!/\.update\(|\.delete\(/.test(updatesRoute), 'the updates route never edits or deletes evidence')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(updatesRoute), 'the updates route performs no outbound call')
assert.ok(!/accepted_total|approved_scope/.test(updatesRoute), 'the updates route never touches the handoff')

// 7. Change-order route separates request from decision.
for (const fragment of [
  'status: 400',
  'status: 401',
  'status: 403',
  'status: 404',
  'status: 409',
  'requireWorkspaceMember',
  'is_workspace_admin',
  "body.action !== 'decide'",
  'nextChangeOrderDecisions(current.status).includes(decision)',
  'summarizeChangeOrders(rows)',
  'amount_delta must be a nonzero amount with at most two decimals.',
]) {
  assert.ok(changeOrderRoute.includes(fragment), `change-order route contains ${fragment}`)
}
assert.ok(changeOrderRoute.includes(".from('production_job_change_orders')"))
assert.ok(changeOrderRoute.includes('can_decide: isAdmin === true'))
assert.ok(!/\.delete\(/.test(changeOrderRoute), 'the route never deletes a change order')
assert.ok(!/fetch\(|axios|https?:\/\//i.test(changeOrderRoute), 'the route performs no outbound call')
assert.ok(!/accepted_total|approved_scope/.test(changeOrderRoute), 'the route never rewrites the handoff')
assert.ok(!/stripe|twilio|resend|sendgrid|mailto/i.test(changeOrderRoute), 'no payment or customer contact path')

// 8. The page shows evidence, decisions, and the boundary.
assert.ok(detailPage.includes('Field updates'))
assert.ok(detailPage.includes('/updates`'))
assert.ok(detailPage.includes('/change-orders`'))
assert.ok(detailPage.includes('Record field update'))
assert.ok(detailPage.includes('Request change order'))
assert.ok(detailPage.includes('describeChangeOrderStatus'))
assert.ok(detailPage.includes('describeAmountDelta'))
assert.ok(detailPage.includes('nextChangeOrderDecisions'))
assert.ok(detailPage.includes('Append-only daily evidence'))
assert.ok(detailPage.includes('not a customer signature'))
assert.ok(detailPage.includes('never rewrites the accepted total or approved scope'))
assert.ok(!/insurer|submit to carrier|auto[- ]?send/i.test(detailPage))

// 9. Real PostgreSQL assertions cover the guards.
for (const marker of [
  'a future-dated field update was accepted',
  'a blank field update was accepted',
  'the update author was not stamped from the caller',
  'a field update was rewritten',
  'a new change order must start requested',
  'the requester was not stamped from the caller',
  'a zero-amount change order was accepted',
  'a member decided a change order',
  'the decider was not stamped from the caller',
  'an approved change order was re-decided',
  'a decision rewrote the requested amount',
  'a change order was deleted',
  'another workspace posted a field update',
  'another workspace requested a change order',
  'field evidence changed the handoff amount or scope',
  'a completed job took a field update',
  'a completed job took a change order',
  'the update trigger allowed an edit',
  'the update trigger allowed a delete',
  'the change-order trigger allowed an edit',
  'the change-order trigger allowed a delete',
]) {
  assert.ok(assertions.includes(marker), `assertions cover: ${marker}`)
}

// 10. Runner stays local-only and applies 069 after 068.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'))
assert.ok(runner.includes('roofos_job_ci'))
assert.ok(runner.includes('069_field_work_change_orders.sql'))
assert.ok(
  runner.indexOf('069_field_work_change_orders.sql') > runner.indexOf('068_production_job_readiness.sql'),
  'migration 069 is applied after 068',
)
assert.ok(runner.includes('production-job-fieldwork-assertions.sql'))

// 11. CI wiring and migration-safety greps.
const pkg = JSON.parse(read('../package.json'))
assert.equal(
  pkg.scripts['test:production-job-fieldwork'],
  'node --experimental-strip-types --no-warnings scripts/production-job-fieldwork-test.mjs',
)
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:production-job-fieldwork'))
assert.ok(ci.includes('069_field_work_change_orders.sql'))
assert.ok(ci.includes('A decided change order is immutable'))

console.log('production-job-fieldwork-test: PASS (append-only daily updates, server-owned author and time, member requests, owner-only decisions with stamped decider, immutable request fields, no re-decision, no delete, completed-job refusal, approved deltas separate from the handoff, real PostgreSQL assertions, CI wiring)')
