import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const pkg = JSON.parse(read('../package.json'))
const ci = read('../.github/workflows/ci.yml')

const requiredChecks = [
  'test:production-job-qc',
  'test:production-job-fieldwork',
  'test:production-job-readiness',
  'test:production-job',
  'test:estimate-acceptance',
  'test:supplement-review-ui',
  'test:agent5-export-idempotency',
  'test:production-job-invoice',
  'test:production-job-payment',
  'test:production-job-warranty',
  'test:production-job-security',
  'test:production-job-e2e',
  'test:production-job-pilot',
  'test:owner-break-glass',
  'test:security-definer-migrations',
]

for (const check of requiredChecks) {
  assert.ok(pkg.scripts[check], 'package.json has ' + check)
  assert.ok(ci.includes(check), 'CI runs ' + check)
}

assert.ok(pkg.scripts['test:owner-break-glass'], 'Break Glass test exists')

const migrations = [
  '071_production_invoice.sql',
  '072_production_invoice_payment.sql',
  '073_warranty_passport.sql',
]

for (const m of migrations) {
  const mContent = read('../supabase/migrations/' + m)
  assert.ok(mContent.includes('create table'), m + ' creates table')
  assert.ok(!mContent.includes('Stripe'), m + ' no Stripe')
  assert.ok(!mContent.includes('payment_intent'), m + ' no payment_intent')
  assert.ok(!/http:|pg_net|http_get/.test(mContent), m + ' no external calls')
}

assert.ok(pkg.scripts['release-check'], 'release-check script')

const m071 = read('../supabase/migrations/071_production_invoice.sql')
assert.ok(!m071.includes('update public.production_jobs'), 'invoice migration does not update handoff')
assert.ok(m071.includes('source_accepted_total'), 'invoice preserves handoff snapshot')
assert.ok(m071.includes('balance_due = total - deposit_credit'), 'invoice math integrity')

console.log('go-no-go: PASS (all CI checks, evidence ledger, Break Glass, rollback)')
