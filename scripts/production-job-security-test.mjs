import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const m071 = read('../supabase/migrations/071_production_invoice.sql')
const m072 = read('../supabase/migrations/072_production_invoice_payment.sql')
const m073 = read('../supabase/migrations/073_warranty_passport.sql')

const route = read('../app/api/production-jobs/[id]/invoices/route.ts')
const qcRoute = read('../app/api/production-jobs/[id]/punch-items/route.ts')
const closeoutRoute = read('../app/api/production-jobs/[id]/closeout/route.ts')
const statusRoute = read('../app/api/production-jobs/[id]/status/route.ts')

const pkg = JSON.parse(read('../package.json'))

// 1. Migrations have no Stripe/payment state
for (const m of [m071, m072, m073]) {
  assert.ok(!m.includes('Stripe'), 'no Stripe in migration')
  assert.ok(!m.includes('payment_intent'), 'no payment_intent in migration')
}

// 2. SQL integrity constraints - invoice math
assert.ok(m071.includes('deposit_credit <= total'), 'invoice: deposit_credit <= total')
assert.ok(m071.includes('balance_due = total - deposit_credit'), 'invoice: balance_due formula')
assert.ok(m073.includes('warranties_one_per_job'), 'warranty: one per job constraint')
assert.ok(m073.includes('roof_passports'), 'roof_passports table')

// 3. Break Glass and security scripts exist
assert.ok(pkg.scripts['test:owner-break-glass'], 'owner break-glass test')
assert.ok(pkg.scripts['test:security-definer-migrations'], 'security definer test')

// 4. Routes have workspace guards
assert.ok(route.includes('requireWorkspaceMember'), 'invoice route: requireWorkspaceMember')
assert.ok(route.includes('is_workspace_admin'), 'invoice route: is_workspace_admin')
assert.ok(qcRoute.includes('requireWorkspaceMember'), 'qc route: requireWorkspaceMember')
assert.ok(closeoutRoute.includes('is_workspace_admin'), 'closeout: is_workspace_admin')
assert.ok(statusRoute.includes('is_workspace_admin'), 'status: is_workspace_admin')

// 5. No unauthorized mutations in SQL
for (const m of [m071, m072, m073]) {
  assert.ok(!/update\s+public\.production_jobs/.test(m), 'no job update in migration')
}

// 6. Security test scripts registered
assert.ok(pkg.scripts['test:security-definer-migrations'].includes('security'), 'security test registered')

console.log('security-test: PASS (migration safety, route guards, Break Glass)')
