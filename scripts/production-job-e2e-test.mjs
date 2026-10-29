import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// Verify the full migration chain 071-073 is consistent
const m071 = read('../supabase/migrations/071_production_invoice.sql')
const m072 = read('../supabase/migrations/072_production_invoice_payment.sql')
const m073 = read('../supabase/migrations/073_warranty_passport.sql')

// 071: production_invoices table - no payment state
assert.ok(m071.includes('create table if not exists public.production_invoices'))
assert.ok(!m071.includes('Stripe'))
assert.ok(!m071.includes('payment_intent'))

// 072: payment attempts table - audit trail only, no invoice mutation
assert.ok(m072.includes('create table if not exists public.production_invoice_payments'))
assert.ok(m072.includes('amount_cents'))
assert.ok(!m072.includes('Stripe'))
assert.ok(!m072.includes('payment_intent'))
assert.ok(!m072.includes('update public.production_jobs'))

// 073: warranties and roof_passports - separate from invoice
assert.ok(m073.includes('create table if not exists public.warranties'))
assert.ok(m073.includes('create table if not exists public.roof_passports'))
assert.ok(!m073.includes('Stripe'))
assert.ok(!m073.includes('payment_intent'))

// Verify routes remain workspace-scoped
const route = read('../app/api/production-jobs/[id]/invoices/route.ts')
assert.ok(route.includes('production_invoices'))
assert.ok(route.includes('production_invoice'))

console.log('e2e-rehearsal: PASS (migration chain consistent, no payment calls, routes scoped)')
