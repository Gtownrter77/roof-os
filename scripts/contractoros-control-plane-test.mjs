import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/102_contractor_os_control_plane.sql', import.meta.url), 'utf8')
const traceability = readFileSync(new URL('../docs/contractor-os/RELEASE-1-TRACEABILITY.md', import.meta.url), 'utf8')

for (const marker of [
  'create table if not exists public.contractor_authority_profiles',
  'create table if not exists public.contractor_mandates',
  'create table if not exists public.contractor_record_revisions',
  'create table if not exists public.contractor_evidence_items',
  'create table if not exists public.contractor_events',
  'create table if not exists public.contractor_work_executions',
  'add column if not exists mandate_id uuid references public.contractor_mandates(id)',
  'add column if not exists expected_revisions jsonb',
  'add column if not exists expected_revision text',
  'add column if not exists verification_state text',
  'create or replace function public.contractor_can_manage_control_plane',
  'select public.is_system_owner() or public.is_workspace_admin(target_workspace)',
  'alter table public.contractor_authority_profiles enable row level security',
  'alter table public.contractor_mandates enable row level security',
  'alter table public.contractor_record_revisions enable row level security',
  'alter table public.contractor_evidence_items enable row level security',
  'alter table public.contractor_events enable row level security',
  'alter table public.contractor_work_executions enable row level security',
  'contractor_authority_profiles_manage',
  'contractor_mandates_manage',
  'contractor_record_revisions_select',
  'contractor_evidence_items_select',
  'contractor_events_select',
  'contractor_work_executions_select',
  'comment on table public.contractor_evidence_items',
  'comment on table public.contractor_work_executions',
]) assert.ok(migration.includes(marker), `Release 1 migration missing: ${marker}`)

for (const marker of [
  'first vertical slice',
  'stale approval denial',
  'duplicate request behavior',
  'Existing lead entry, magic-link authentication, and mobile local/offline storage remain untouched',
]) assert.ok(traceability.toLowerCase().includes(marker.toLowerCase()), `traceability missing: ${marker}`)

assert.ok(!migration.includes('\na comment on '), 'migration contains invalid comment keyword')
assert.match(migration, /review_status text not null default 'unreviewed'/)
assert.match(migration, /processing_status text not null default 'received'/)
assert.match(migration, /status text not null default 'planned'/)
assert.match(migration, /unique \(workspace_id, event_key\)/)
assert.match(migration, /unique \(workspace_id, execution_key\)/)
console.log('contractoros-control-plane-test: PASS')
