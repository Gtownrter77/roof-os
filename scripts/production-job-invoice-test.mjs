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
const migration = read('../supabase/migrations/071_production_invoice.sql')
const invoicesRoute = read('../app/api/production-jobs/[id]/invoices/route.ts')
const invoicing = read('../lib/jobs/invoicing.ts')
const changeOrderRoute = read('../app/api/production-jobs/[id]/change-orders/route.ts')
const detailPage = read('../app/jobs/[id]/page.tsx')
const assertions = read('../scripts/ci/production-job-invoice-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')

// 1. Vocabulary is stable.
assert.deepEqual([...CHANGE_ORDER_STATUSES], ['requested', 'approved', 'declined'])
assert.deepEqual([...CHANGE_ORDER_DECISIONS], ['approved', 'declined'])

// 2. Migration 071 adds production_invoices table with no payment state.
assert.ok(migration.includes('create table if not exists public.production_invoices'))
assert.ok(migration.includes('create unique index if not exists production_invoices_one_live_per_job'))
assert.ok(!migration.includes('Stripe'))

// 3. Invoice lifecycle is draft -> issued -> void
assert.ok(migration.includes("status text not null default 'draft'"))
assert.ok(migration.includes("check (status in ('draft','issued','void'))"))

// 4. Route contracts
for (const fragment of [
  'production_invoices',
  'buildInvoiceDraft',
  'nextInvoiceStatuses',
]) {
  assert.ok(invoicesRoute.includes(fragment), `invoices route contains ${fragment}`)
}

// 5. Cannot create invoice without scope
assert.ok(migration.includes("An invoice needs at least one approved scope line"))
assert.ok(migration.includes("The approved scope does not reconcile with the accepted total and tax"))

// 6. Reconciliation check
assert.ok(migration.includes("abs(v_scope_subtotal + v_acceptance.accepted_tax - v_job.accepted_total) > 0.005"))

// 7. Change order only approved lines
assert.ok(migration.includes("status = 'approved'"))
assert.ok(migration.includes("v_change_total"))

// 8. Deposit credit from ledger
assert.ok(migration.includes('estimate_deposit_events'))
assert.ok(migration.includes('least(greatest(v_deposit, 0)'))
assert.ok(migration.includes('balance_due = total - deposit_credit'))

// 9. Issued immutability
assert.ok(migration.includes("A void invoice is immutable"))
assert.ok(migration.includes("Invoice money, scope evidence, and identity are immutable"))
assert.ok(migration.includes("Only an invoice status move is allowed"))

// 10. Payment state absent - only audit
assert.ok(!invoicesRoute.includes('Stripe'))
assert.ok(!invoicesRoute.includes('twilio'))
assert.ok(!invoicesRoute.includes('resend'))
assert.ok(!invoicesRoute.includes('sendgrid'))
assert.ok(!invoicesRoute.includes('mailto'))

// 11. Database trigger computation
assert.ok(migration.includes('before insert or update or delete on public.production_invoices'))
assert.ok(migration.includes('enforce_production_invoice'))
assert.ok(migration.includes('A production invoice cannot be deleted; void it instead'))
assert.ok(migration.includes('A void invoice is immutable'))

// 12. No payment state in DB
assert.ok(!migration.includes('Stripe'))
assert.ok(!migration.includes('payment_intent'))
assert.ok(!migration.includes('paid'))
assert.ok(!migration.includes('amount_paid'))

// 13. Package test script exists and references new migration
const pkg = JSON.parse(read('../package.json'))
assert.equal(pkg.scripts['test:production-job-invoice'], 'node --experimental-strip-types --no-warnings scripts/production-job-invoice-test.mjs')

// 14. CI wiring
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('071_production_invoice.sql'), 'ci.yml references migration 071')
assert.ok(ci.includes('production-job-invoice-assertions.sql'), 'ci.yml references invoice assertions')
assert.ok(ci.includes('npm run test:production-job-invoice'), 'ci.yml runs invoice test')

// 15. docs link
const docs = read('../docs/jobs/invoicing.md')
assert.ok(docs.includes('production_invoices'))
assert.ok(docs.includes('source_accepted_total'))
assert.ok(docs.includes('change_order_total'))

console.log('production-job-invoice-test: PASS (invoice table, trigger, assertions, runner, CI, docs)')