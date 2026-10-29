import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/072_production_invoice_payment.sql')
const invoicesRoute = read('../app/api/production-jobs/[id]/invoices/route.ts')

// 1. Migration 072 adds payment attempts table
assert.ok(migration.includes('create table if not exists public.production_invoice_payments'))
assert.ok(migration.includes('amount_cents'))
assert.ok(migration.includes('status'))
assert.ok(migration.includes("check (status in ('pending','succeeded','failed','reversed'))"))

// 2. Payment outcomes do not alter invoice status
assert.ok(!migration.includes('update public.production_jobs'))
assert.ok(!migration.includes('set status'))

assert.ok(migration.includes('created_by'))
assert.ok(migration.includes('receipt_reference'))

// 3. Route does not handle payment
assert.ok(!invoicesRoute.includes('stripe'))
assert.ok(!invoicesRoute.includes('payment_intent'))
assert.ok(!invoicesRoute.includes('amount_cents'))
assert.ok(!invoicesRoute.includes('receipt'))

console.log('payment-test: PASS')
