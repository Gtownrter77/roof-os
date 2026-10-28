import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { deriveDepositState, ACCEPTANCE_DISCLAIMER } = await import('../lib/estimates/acceptance.ts')
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/063_estimate_acceptance_deposit.sql')
const route = read('../app/api/estimates/[id]/acceptance/route.ts')
const page = read('../app/estimate/[id]/page.tsx')
const assertions = read('../scripts/ci/estimate-acceptance-assertions.sql')
const runner = read('../scripts/ci/verify-estimate-acceptance-postgres.sh')

const event = (event_type, amount, occurred_at, extra = {}) => ({ id: `${event_type}-${occurred_at}`, event_type, amount, occurred_at, ...extra })

// 1. Full deposit lifecycle is derived from events, not from a mutable balance.
const full = deriveDepositState(10000, [
  event('requested', 3000, '2026-11-10T15:00:00.000Z'),
  event('received', 3000, '2026-11-11T15:00:00.000Z', { method: 'check' }),
  event('refunded', 1000, '2026-11-12T15:00:00.000Z', { method: 'check' }),
])
assert.equal(full.status, 'refunded')
assert.equal(full.requestedAmount, 3000)
assert.equal(full.receivedAmount, 3000)
assert.equal(full.refundedAmount, 1000)
assert.equal(full.appliedAmount, 2000)
assert.equal(full.outstandingAmount, 0)
assert.equal(full.problem, null)
assert.deepEqual(full.nextAllowedEvents, [])

// 2. Requested but not received leaves an outstanding amount and one allowed action.
const requested = deriveDepositState(10000, [event('requested', 2500, '2026-11-10T15:00:00.000Z')])
assert.equal(requested.status, 'requested')
assert.equal(requested.outstandingAmount, 2500)
assert.deepEqual(requested.nextAllowedEvents, ['received'])
assert.equal(requested.appliedAmount, 0)

const received = deriveDepositState(10000, [
  event('requested', 2500, '2026-11-10T15:00:00.000Z'),
  event('received', 2500, '2026-11-11T15:00:00.000Z'),
])
assert.equal(received.status, 'received')
assert.equal(received.outstandingAmount, 0)
assert.equal(received.appliedAmount, 2500)
assert.deepEqual(received.nextAllowedEvents, ['refunded'])

// 3. A waiver is a single event with no amount and no further action.
const waived = deriveDepositState(10000, [event('waived', 0, '2026-11-10T15:00:00.000Z')])
assert.equal(waived.status, 'waived')
assert.equal(waived.requestedAmount, 0)
assert.deepEqual(waived.nextAllowedEvents, [])

// 4. No acceptance means no deposit, and nothing is assumed.
const none = deriveDepositState(0, [])
assert.equal(none.status, 'none')
assert.equal(none.label, 'No deposit recorded')
assert.deepEqual(none.nextAllowedEvents, ['requested', 'waived'])

// 5. Out-of-order events are reported, never silently accepted.
const outOfOrder = deriveDepositState(10000, [
  event('received', 2500, '2026-11-10T15:00:00.000Z'),
  event('refunded', 2500, '2026-11-11T15:00:00.000Z'),
])
assert.ok(outOfOrder.problem, 'out-of-order ledger is flagged')
assert.ok(outOfOrder.problem.includes('received after it is requested'))

// 6. Deposits cannot exceed the accepted total, and refunds cannot exceed receipts.
const overTotal = deriveDepositState(1000, [event('requested', 2000, '2026-11-10T15:00:00.000Z')])
assert.ok(overTotal.problem.includes('accepted total'))
const overRefund = deriveDepositState(10000, [
  event('requested', 1000, '2026-11-10T15:00:00.000Z'),
  event('received', 1000, '2026-11-11T15:00:00.000Z'),
  event('refunded', 1500, '2026-11-12T15:00:00.000Z'),
])
assert.ok(overRefund.problem.includes('Refunds exceed'))

// 7. Migration: approved-only, server-owned evidence, one per estimate, append-only.
assert.ok(migration.includes('create table if not exists public.estimate_acceptances'), 'acceptance table')
assert.ok(migration.includes('create table if not exists public.estimate_deposit_events'), 'deposit ledger')
assert.ok(migration.includes('unique (estimate_id)'), 'one acceptance per estimate')
assert.ok(migration.includes("if v_estimate.status <> 'approved'"), 'acceptance requires an approved estimate')
assert.ok(migration.includes('NEW.accepted_subtotal := v_estimate.subtotal'), 'subtotal is copied by the database')
assert.ok(migration.includes('NEW.accepted_tax := v_estimate.tax'), 'tax is copied by the database')
assert.ok(migration.includes('NEW.accepted_total := v_estimate.total'), 'total is copied by the database')
assert.ok(migration.includes('NEW.estimate_formula_version := v_estimate.formula_version'), 'formula version is copied')
assert.ok(migration.includes('NEW.accepted_at := now()'), 'acceptance time is server-owned')
assert.ok(migration.includes('NEW.occurred_at := now()'), 'deposit event time is server-owned')
assert.ok(migration.includes('A recorded estimate acceptance is immutable'), 'acceptance is immutable')
assert.ok(migration.includes('A deposit event is immutable'), 'deposit events are immutable')
assert.ok(migration.includes("if v_last_type = 'refunded'"), 'no events after a refund')
assert.ok(migration.includes("if v_last_type is distinct from 'requested'"), 'a deposit is received only after a request')
assert.ok(migration.includes('A requested deposit cannot exceed the accepted total'), 'request cannot exceed the accepted total')
assert.ok(!/signature_data|signature_url|signed_pdf/.test(migration), 'no signature storage is invented')
assert.ok(!/authorize\.net|stripe|payment_intent|charge/i.test(migration), 'migration never charges money')

// 8. RLS: members record the caller as recorder; no update/delete policy exists.
assert.ok(migration.includes('estimate_acceptances_select'), 'acceptance select policy')
assert.ok(migration.includes('auth.uid() = recorded_by'), 'acceptance records the caller')
assert.ok(migration.includes('estimate_deposit_events_select'), 'deposit select policy')
assert.ok(!/create policy estimate_acceptances_(update|delete)/.test(migration), 'no acceptance update/delete policy')
assert.ok(!/create policy estimate_deposit_events_(update|delete)/.test(migration), 'no deposit update/delete policy')

// 9. Route: authenticated, workspace scoped, explicit status codes, no e-signature claim.
assert.ok(route.includes('status: 401'), 'unauthenticated request is rejected')
assert.ok(route.includes('status: 404'), 'foreign estimate is not leaked')
assert.ok(route.includes(".eq('workspace_id', workspaceId)"), 'queries are workspace scoped')
assert.ok(route.includes('ACCEPTANCE_DISCLAIMER'), 'route returns the disclaimer')
assert.ok(route.includes('status: 409'), 'duplicate or state-conflict is a 409')
assert.ok(!/signature|signed_pdf|docusign|dropbox\.sign/i.test(route), 'no signature feature is claimed')
assert.ok(!/stripe|authorize\.net|payment_intent|card_number/i.test(route), 'route never charges money')

// 10. Page: the operator sees that this is not a signature and that the record is immutable.
assert.ok(ACCEPTANCE_DISCLAIMER.includes('not an electronic signature'), 'disclaimer is explicit')
assert.ok(page.includes('ACCEPTANCE_DISCLAIMER') === false, 'page uses the API disclaimer')
assert.ok(page.includes('disclaimer'), 'page renders the disclaimer')
assert.ok(page.includes('This record is immutable'), 'page states immutability')
assert.ok(page.includes("estimate.status === 'approved'"), 'acceptance UI is approval gated')
assert.ok(page.includes('role="alert"'), 'errors are announced')
assert.ok(page.includes('Nothing here charges a card'), 'no implied payment')

// 11. Real PostgreSQL assertions cover the gate, isolation and ledger rules.
assert.ok(assertions.includes('unapproved estimate'), 'assertions check the approval gate')
assert.ok(assertions.includes('cross-workspace'), 'assertions check workspace isolation')
assert.ok(assertions.includes('immutable'), 'assertions check acceptance immutability')
assert.ok(assertions.includes('received must follow requested'), 'assertions check the deposit order')
assert.ok(assertions.includes('cannot exceed the accepted total'), 'assertions check the accepted total cap')
assert.ok(assertions.includes('cannot receive new events'), 'assertions check the refund terminal state')
assert.ok(assertions.includes('RLS'), 'assertions check row level security')

// 12. Runner is local-only and uses a dedicated disposable database.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'), 'runner refuses non-local host')
assert.ok(runner.includes('roofos_acceptance_ci'), 'runner uses a dedicated disposable database')
assert.ok(runner.includes('063_estimate_acceptance_deposit.sql'), 'runner applies migration 063')
assert.ok(runner.includes('estimate-acceptance-assertions.sql'), 'runner executes the assertions')

console.log('estimate-acceptance-test: PASS (approved-only acceptance, server-owned amounts and times, immutable evidence, append-only deposit state machine, workspace isolation, no signature or payment claim)')
