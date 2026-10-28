import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/061_lead_deduplication.sql')
const page = read('../app/leads/new/page.tsx')
const runner = read('../scripts/ci/verify-lead-dedup-postgres.sh')
const assertions = read('../scripts/ci/lead-dedup-assertions.sql')

// 1. Migration shape: normalisation, scoped guard, concurrency, override.
assert.ok(migration.includes('create or replace function public.lead_phone_digits'), 'phone normaliser defined')
assert.ok(/regexp_replace\(coalesce\(value, ''\), '\\D', '', 'g'\)/.test(migration), 'non-digits stripped')
assert.ok(migration.includes('create or replace function public.prevent_duplicate_lead'), 'duplicate guard defined')
assert.ok(/security definer set search_path = public/.test(migration), 'guard pins search_path')
assert.ok(migration.includes('before insert or update of phone, workspace_id'), 'guard covers insert and phone update')
assert.ok(migration.includes('pg_advisory_xact_lock'), 'inserts are serialised per workspace')
assert.ok(/where workspace_id = new\.workspace_id/.test(migration), 'duplicate lookup is workspace scoped')
assert.ok(/id <> new\.id/.test(migration), 'an update does not match itself')
assert.ok(/allow_duplicate_lead/.test(migration), 'explicit office override exists')
assert.ok(/errcode = '23505'/.test(migration), 'duplicate raises a unique violation')
assert.ok(!/create unique index/i.test(migration), 'no unique index that could fail on historic duplicates')
assert.ok(/create index if not exists leads_workspace_phone_digits_idx/.test(migration), 'lookup index is non-unique')

// 2. The guard must not block leads without a usable phone.
assert.ok(/length\(v_phone\) < 10/.test(migration), 'short or missing phone is not deduplicated')

// 3. UI surfaces the duplicate instead of a raw database error.
assert.ok(page.includes('already exists'), 'page detects the duplicate error')
assert.ok(page.includes('Open existing leads'), 'page offers a path to the existing record')
assert.ok(page.includes("router.push('/leads')"), 'duplicate button navigates to leads')
assert.ok(/role="alert"/.test(page), 'error is announced to assistive technology')

// 4. Real PostgreSQL assertions cover the important cases.
assert.ok(assertions.includes('unique_violation'), 'assertions catch the duplicate violation')
assert.ok(assertions.includes('different number'), 'different number is accepted')
assert.ok(assertions.includes('other workspace'), 'same phone in another workspace is allowed')
assert.ok(assertions.includes('duplicate phone update rejection'), 'update path is covered')
assert.ok(assertions.includes('allow_duplicate_lead'), 'override path is covered')

// 5. Runner is local-only and uses a dedicated database.
assert.ok(runner.includes("test \"$PGHOST\" = 127.0.0.1"), 'runner refuses non-local host')
assert.ok(runner.includes('roofos_lead_ci'), 'runner uses a dedicated disposable database')
assert.ok(runner.includes('lead-dedup-assertions.sql'), 'runner executes the assertions')

console.log('lead-dedup-test: PASS (migration 061 normalisation/scope/override, duplicate UI handling, PostgreSQL assertion coverage, local-only runner)')
