import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration073 = read('../supabase/migrations/073_warranty_passport.sql')
const migration074 = read('../supabase/migrations/074_payment_warranty_guards.sql')
const baseline = read('../scripts/ci/production-job-baseline.sql')
const lifecycle = read('../scripts/ci/production-job-lifecycle-assertions.sql')

// Production already has the original 020 warranty/passport schema. Migration
// 073 must extend it, not let CREATE TABLE IF NOT EXISTS silently skip fields.
for (const marker of [
  'alter table public.warranties',
  'add column if not exists job_id',
  'add column if not exists issued_at',
  'add column if not exists status',
  'registration_status',
  'warranties_one_per_job',
  'where job_id is not null',
  'alter table public.roof_passports',
  'add column if not exists lifecycle_status',
  'add column if not exists job_id',
  'public_token',
  'public_shared',
  'draft',
  'transferred',
  'archived',
]) {
  assert.ok(migration073.toLowerCase().includes(marker.toLowerCase()), `073 legacy schema compatibility missing: ${marker}`)
}

// The 074 passport lifecycle must use its own lifecycle_status. The legacy
// status column is constrained to draft/active/transferred/archived.
const passportGuard = migration074.slice(migration074.indexOf('create or replace function public.enforce_roof_passport_lifecycle'))
assert.ok(passportGuard.includes('new.lifecycle_status'), 'passport guard must use lifecycle_status')
assert.ok(passportGuard.includes('old.lifecycle_status'), 'passport guard must read lifecycle_status')
assert.ok(passportGuard.includes('new.job_id is null'), 'passport guard must preserve legacy lead-linked passports')
assert.ok(!passportGuard.includes("new.status := 'pending'"), 'passport guard must not overwrite the legacy status')
assert.ok(!passportGuard.includes("old.status = 'revoked'"), 'passport guard must not compare legacy status to lifecycle states')

const warrantyGuard = migration074.slice(migration074.indexOf('create or replace function public.enforce_warranty_lifecycle'), migration074.indexOf('create or replace function public.enforce_roof_passport_lifecycle'))
assert.ok(warrantyGuard.includes('new.job_id is null'), 'warranty guard must preserve legacy lead-linked warranty rows')
assert.ok(warrantyGuard.includes('old.job_id is null'), 'warranty guard must prevent mutating legacy rows into job lifecycle records')

// The PostgreSQL lifecycle rehearsal must model the already-shipped 020 schema,
// then run 073/074 against it and exercise both old and new contracts.
for (const marker of [
  'create table public.roof_passports',
  'create table public.warranties',
  "status in ('draft','active','transferred','archived')",
  'registration_status',
  'public_token',
  'public_shared',
]) assert.ok(baseline.includes(marker), `PostgreSQL baseline missing legacy schema marker: ${marker}`)

for (const marker of [
  'Legacy warranty record',
  'Legacy Roof Passport',
  'registration_status',
  'lifecycle_status',
  'public_shared',
]) assert.ok(lifecycle.includes(marker), `Lifecycle SQL rehearsal missing legacy compatibility case: ${marker}`)

console.log('production-job-warranty-legacy-compat-test: PASS')
