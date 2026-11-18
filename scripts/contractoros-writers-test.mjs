import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const migration = readFileSync(new URL('supabase/migrations/103_contractor_os_narrow_writers.sql', root), 'utf8')

const functions = [
  'contractor_create_mandate',
  'contractor_transition_mandate',
  'contractor_capture_evidence',
  'contractor_review_evidence',
  'contractor_create_record_revision',
  'contractor_review_record_revision',
]
for (const name of functions) {
  assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`), `${name} writer missing`)
  assert.match(migration, new RegExp(`comment on function public\\.${name}\\(`), `${name} documentation missing`)
}

for (const marker of [
  'security definer',
  'set search_path = public',
  "if v_user_id is null then raise exception 'authentication required'",
  'contractor_can_manage_control_plane',
  "raise exception 'released revision is immutable'",
  "raise exception 'evidence review is immutable'",
  "raise exception 'terminal mandate cannot be transitioned'",
  "raise exception 'revision must be reviewed before release'",
  'pg_advisory_xact_lock',
  'grant execute on function public.contractor_create_mandate',
  'grant execute on function public.contractor_capture_evidence',
  'grant execute on function public.contractor_create_record_revision',
]) assert.ok(migration.includes(marker), `writer migration invariant missing: ${marker}`)

const routes = [
  'app/api/contractor-os/mandates/route.ts',
  'app/api/contractor-os/mandates/[id]/status/route.ts',
  'app/api/contractor-os/evidence/route.ts',
  'app/api/contractor-os/evidence/[id]/review/route.ts',
  'app/api/contractor-os/revisions/route.ts',
  'app/api/contractor-os/revisions/[id]/review/route.ts',
]
for (const relative of routes) {
  assert.ok(existsSync(new URL(relative, root)), `${relative} is missing`)
  const source = readFileSync(new URL(relative, root), 'utf8')
  assert.match(source, /getContractorContext/, `${relative} lacks authenticated workspace context`)
  assert.match(source, /\.rpc\('contractor_/, `${relative} must use a narrow RPC writer`)
  assert.doesNotMatch(source, /createAdminClient|service_role|\.from\(['"]contractor_/, `${relative} contains an unsafe direct control-plane write path`)
}

const helper = readFileSync(new URL('lib/contractor-os/writer-api.ts', root), 'utf8')
assert.match(helper, /requireWorkspaceMember/)
assert.match(helper, /current_workspace_id/)
assert.match(helper, /Authentication required/)
console.log('contractoros-writers-test: PASS')
