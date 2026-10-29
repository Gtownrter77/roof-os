import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration071 = read('../supabase/migrations/071_production_invoice.sql')
const migration072 = read('../supabase/migrations/072_production_invoice_payment.sql')
const migration073 = read('../supabase/migrations/073_warranty_passport.sql')
const migration074 = read('../supabase/migrations/074_payment_warranty_guards.sql')
const lifecycle = read('../scripts/ci/production-job-lifecycle-assertions.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')
const restoreRunner = read('../scripts/ci/verify-restore-postgres.sh')
const route = read('../app/api/production-jobs/[id]/invoices/route.ts')
const qcRoute = read('../app/api/production-jobs/[id]/punch-items/route.ts')
const closeoutRoute = read('../app/api/production-jobs/[id]/closeout/route.ts')
const statusRoute = read('../app/api/production-jobs/[id]/status/route.ts')
const ci = read('../.github/workflows/ci.yml')
const pkg = JSON.parse(read('../package.json'))

assert.ok(migration071.includes('create table if not exists public.production_invoices'))
assert.ok(migration072.includes('create table if not exists public.production_invoice_payments'))
assert.ok(migration073.includes('create table if not exists public.warranties'))
assert.ok(migration073.includes('create table if not exists public.roof_passports'))
assert.ok(migration074.includes('enforce_production_invoice_payment'))
assert.ok(migration074.includes('enforce_warranty_lifecycle'))
assert.ok(migration074.includes('enforce_roof_passport_lifecycle'))

// The rehearsal is a real SQL run, not only a source-text check.
assert.ok(lifecycle.includes("status='in_progress'"))
assert.ok(lifecycle.includes("status='completed'"))
assert.ok(lifecycle.includes("status='issued'"))
assert.ok(lifecycle.includes("status='succeeded'"))
assert.ok(lifecycle.includes("status='reversed'"))
assert.ok(lifecycle.includes("status='void'"))
assert.ok(lifecycle.includes('warranties'))
assert.ok(lifecycle.includes('roof_passports'))
assert.ok(lifecycle.includes('Expected completion-without-closeout rejection'))
assert.ok(lifecycle.includes('Expected critical-item closeout rejection'))
assert.ok(lifecycle.includes('Expected draft-invoice payment rejection'))
assert.ok(lifecycle.includes('Expected void-invoice payment rejection'))
assert.ok(lifecycle.includes('Expected one-warranty-per-job rejection'))

// Both rehearsals are applied to the disposable PostgreSQL database in CI.
assert.ok(runner.includes('074_payment_warranty_guards.sql'))
assert.ok(runner.includes('production-job-lifecycle-assertions.sql'))
assert.ok(runner.includes('Supabase Auth/Storage remains untested'))
assert.ok(restoreRunner.includes('pg_dump'))
assert.ok(restoreRunner.includes('pg_restore'))
assert.ok(restoreRunner.includes('SCHEMA - public'))
assert.ok(restoreRunner.includes('--use-list'))
assert.ok(restoreRunner.includes('row level security was lost in restore'))

assert.ok(route.includes('production_invoices'))
assert.ok(route.includes('production_invoice'))
assert.ok(qcRoute.includes('production_job_punch_items'))
assert.ok(qcRoute.includes('requireWorkspaceMember'))
assert.ok(closeoutRoute.includes('production_job_closeouts'))
assert.ok(closeoutRoute.includes('is_workspace_admin'))
assert.ok(statusRoute.includes('is_workspace_admin'))
assert.ok(statusRoute.includes('requireWorkspaceMember'))

assert.equal(pkg.scripts['test:production-job-invoice'],
    'node --experimental-strip-types --no-warnings scripts/production-job-invoice-test.mjs')
assert.equal(pkg.scripts['test:production-job-payment'],
    'node --experimental-strip-types --no-warnings scripts/production-job-payment-test.mjs')
assert.equal(pkg.scripts['test:production-job-warranty'],
    'node --experimental-strip-types --no-warnings scripts/production-job-warranty-test.mjs')
assert.equal(pkg.scripts['test:production-job-e2e'],
    'node --experimental-strip-types --no-warnings scripts/production-job-e2e-test.mjs')

// The web checks must actually run the day 26 and day 27 suites.
assert.ok(ci.includes('test:production-job-warranty'))
assert.ok(ci.includes('test:production-job-e2e'))

console.log('e2e-rehearsal: PASS (real lifecycle SQL wired to CI, exception paths, backup/restore rehearsal, contract scripts registered)')
