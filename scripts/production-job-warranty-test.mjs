import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/073_warranty_passport.sql')
const runner = read('../scripts/ci/verify-production-job-postgres.sh')
const baseline = read('../scripts/ci/production-job-baseline.sql')

// Migration 073 extends, rather than replaces, the production 020 schema.
assert.ok(migration.includes('create table if not exists public.warranties'))
assert.ok(migration.includes('create table if not exists public.roof_passports'))
assert.ok(migration.includes('alter table public.warranties'))
assert.ok(migration.includes('add column if not exists job_id uuid references public.production_jobs'))
assert.ok(migration.includes('add column if not exists issued_at'))
assert.ok(migration.includes('add column if not exists status'))
assert.ok(migration.includes('registration_status'))
assert.ok(migration.includes("registration_status in ('not_started','packet_ready','submitted','registered','expired','claim_open')"))
assert.ok(migration.includes('warranties_one_per_job'))
assert.ok(migration.includes('where job_id is not null'))
assert.ok(!migration.includes('job_id uuid not null references public.production_jobs'))
assert.ok(migration.includes('add column if not exists lifecycle_status'))
assert.ok(migration.includes("lifecycle_status in ('pending','generated','issued','revoked')"))
assert.ok(migration.includes("status text not null default 'draft'"))
assert.ok(migration.includes("status in ('draft','active','transferred','archived')"))
assert.ok(migration.includes('public_token'))
assert.ok(migration.includes('public_shared'))
assert.ok(migration.includes('generated_at'))
assert.ok(migration.includes('data jsonb'))
assert.ok(migration.includes('version'))

// The isolated SQL runner starts from the deployed legacy table contracts.
assert.ok(baseline.includes("status in ('draft','active','transferred','archived')"))
assert.ok(baseline.includes('registration_status'))
assert.ok(baseline.includes('public_token'))
assert.ok(baseline.includes('public_shared'))
assert.ok(runner.includes('073_warranty_passport.sql'))
assert.ok(runner.includes('074_payment_warranty_guards.sql'))

// Schema changes are local database lifecycle guards only; no provider or
// external submission is performed by these migrations.
assert.ok(!/Stripe|twilio|resend|sendgrid|http:|pg_net|http_get/.test(migration))

console.log('warranty-test: PASS (legacy property schema preserved; nullable job lifecycle added)')
