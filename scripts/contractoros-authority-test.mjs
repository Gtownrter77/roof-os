import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const migration = readFileSync(new URL('supabase/migrations/104_contractor_os_action_authority.sql', root), 'utf8')
for (const marker of [
  'contractor_effective_authority',
  'contractor_enforce_action_approval_authority',
  'before insert on public.agent_approval_events',
  "raise exception 'approver has no workspace authority profile'",
  "raise exception 'approver authority is insufficient for this action risk level'",
  "authority_state = 'allowed'",
  'set search_path = public',
  'revoke all on function public.contractor_effective_authority',
  'grant execute on function public.contractor_effective_authority',
]) assert.ok(migration.includes(marker), `authority migration invariant missing: ${marker}`)

const apiPath = 'app/api/contractor-os/authority-profiles/route.ts'
assert.ok(existsSync(new URL(apiPath, root)), 'authority profile API is missing')
const api = readFileSync(new URL(apiPath, root), 'utf8')
for (const marker of ['getUser()', 'is_workspace_admin', 'readJson', "upsert(rows, { onConflict: 'workspace_id,role_key' }"]) {
  assert.ok(api.includes(marker), `authority API invariant missing: ${marker}`)
}
assert.doesNotMatch(api, /createAdminClient|service_role/, 'authority API must not bypass user authorization')

const component = readFileSync(new URL('components/ContractorAuthorityProfiles.tsx', root), 'utf8')
for (const marker of ['/api/contractor-os/authority-profiles', 'Save profiles', 'Approval authority is evaluated at approval time']) {
  assert.ok(component.includes(marker), `authority UI invariant missing: ${marker}`)
}

const approval = readFileSync(new URL('supabase/migrations/053_agent_action_ledger.sql', root), 'utf8')
assert.match(approval, /insert into public\.agent_approval_events/, 'approval RPC must retain append-only approval event write')
console.log('contractoros-authority-test: PASS')
