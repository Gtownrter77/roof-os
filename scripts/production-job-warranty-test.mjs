import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/073_warranty_passport.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')

// 1. Migration 073 adds warranties and roof_passports tables
assert.ok(migration.includes('create table if not exists public.warranties'))
assert.ok(migration.includes('create table if not exists public.roof_passports'))
assert.ok(migration.includes('issued_at'))
assert.ok(migration.includes('expires_at'))
assert.ok(migration.includes("status in ('active','expired','revoked')"))
assert.ok(migration.includes('generated_at'))
assert.ok(migration.includes("status in ('pending','generated','issued','revoked')"))

// 2. Warranty is one per job, linked to production_job
assert.ok(migration.includes('constraint warranties_one_per_job unique (job_id)'))
assert.ok(migration.includes('job_id uuid not null references public.production_jobs'))

assert.ok(migration.includes('data jsonb'))
assert.ok(migration.includes('version'))

// 3. Route/wiring does not auto-generate ESX or insurer submission
// (just schema; no outbound calls in the migration)
assert.ok(!/Stripe|twilio|resend|sendgrid|http:|pg_net|http_get/.test(migration))

console.log('warranty-test: PASS')
