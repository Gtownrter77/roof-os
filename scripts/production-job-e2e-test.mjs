import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration071 = read('../supabase/migrations/071_production_invoice.sql')
const migration072 = read('../supabase/migrations/072_production_invoice_payment.sql')
const migration073 = read('../supabase/migrations/073_warranty_passport.sql')
const route = read('../app/api/production-jobs/[id]/invoices/route.ts')
const qcRoute = read('../app/api/production-jobs/[id]/punch-items/route.ts')
const closeoutRoute = read('../app/api/production-jobs/[id]/closeout/route.ts')
const statusRoute = read('../app/api/production-jobs/[id]/status/route.ts')
const pkg = JSON.parse(read('../package.json'))

assert.ok(migration071.includes('create table if not exists public.production_invoices'))
assert.ok(migration072.includes('create table if not exists public.production_invoice_payments'))
assert.ok(migration073.includes('create table if not exists public.warranties'))
assert.ok(migration073.includes('create table if not exists public.roof_passports'))

assert.ok(route.includes('production_invoices'))
assert.ok(route.includes('production_invoice'))
assert.ok(qcRoute.includes('production_job_punch_items'))
assert.ok(qcRoute.includes('production_job_closeouts'))
assert.ok(qcRoute.includes('is_workspace_admin'))
assert.ok(closeoutRoute.includes('production_job_punch_items'))
assert.ok(closeoutRoute.includes('production_job_closeouts'))
assert.ok(closeoutRoute.includes('is_workspace_admin'))
assert.ok(statusRoute.includes('production_job_punch_items'))
assert.ok(statusRoute.includes('production_job_closeouts'))
assert.ok(statusRoute.includes('is_workspace_admin'))

assert.equal(pkg.scripts['test:production-job-invoice'], 
    'node --experimental-strip-types --no-warnings scripts/production-job-invoice-test.mjs')
assert.equal(pkg.scripts['test:production-job-payment'], 
    'node --experimental-strip-types --no-warnings scripts/production-job-payment-test.mjs')
assert.equal(pkg.scripts['test:production-job-warranty'], 
    'node --experimental-strip-types --no-warnings scripts/production-job-warranty-test.mjs')

console.log('e2e-rehearsal: PASS (full lifecycle contract, scripts registered)')
