import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const migration = readFileSync(new URL('../supabase/migrations/039_crm_missing_spokes.sql', import.meta.url), 'utf8')
const atomicity = readFileSync(new URL('../supabase/migrations/043_inspection_activity_atomicity.sql', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../app/leads/[id]/page.tsx', import.meta.url), 'utf8')
const list = readFileSync(new URL('../app/leads/LeadsClient.tsx', import.meta.url), 'utf8')
const create = readFileSync(new URL('../app/leads/new/page.tsx', import.meta.url), 'utf8')

for (const column of [
  'next_action',
  'next_action_due',
  'next_action_owner_id',
  'lead_score',
  'lead_score_reasons',
  'lost_reason',
  'lost_reason_detail',
  'lost_at',
  'qualified_at',
  'last_activity_at',
]) {
  if (!migration.includes(`add column if not exists ${column}`)) throw new Error(`Missing CRM column: ${column}`)
}

for (const required of [
  'refresh_lead_score',
  'lead_activity_updates_lead',
  'refresh_lead_activity_timestamp',
  'leads_refresh_score',
  'revoke execute on function public.refresh_lead_score(uuid)',
]) {
  if (!migration.includes(required)) throw new Error(`Missing CRM guard/trigger: ${required}`)
}

for (const required of ['Next action', 'Lost reason', 'lead_score', 'Save next action']) {
  if (!detail.includes(required)) throw new Error(`Lead detail missing CRM UI: ${required}`)
}

for (const required of ['priorityFilters', 'needs_action', 'overdue', 'lead_score']) {
  if (!list.includes(required)) throw new Error(`Lead list missing CRM view: ${required}`)
}

if (!create.includes('nextAction') || !create.includes('First contact')) {
  throw new Error('New lead flow does not establish a next action')
}

console.log('crm-missing-spokes-test passed')

for (const required of [
  'appointment_inspection_activity',
  'inspection_session_start_activity',
  'appointment_scheduled:',
  'inspection_started:',
  "kind, body",
]) {
  if (!atomicity.includes(required)) throw new Error(`Missing atomic inspection continuity: ${required}`)
}

const ownerIntegrity = readFileSync(new URL('../supabase/migrations/044_lead_next_action_owner_integrity.sql', import.meta.url), 'utf8')
const leadOwnerIntegrity = readFileSync(new URL('../supabase/migrations/047_lead_owner_workspace_integrity.sql', import.meta.url), 'utf8')
for (const required of [
  'ensure_lead_next_action_owner',
  'leads_next_action_owner_workspace_guard',
  'new.workspace_id is not null and new.next_action_owner_id is not null',
  'Next action owner must be a member of the lead workspace',
]) {
  if (!ownerIntegrity.includes(required)) throw new Error(`Missing next-action owner integrity guard: ${required}`)
}
for (const required of [
  'enforce_lead_owner_workspace_consistency',
  'leads_owner_workspace_guard',
  'Lead owner must be a member of the lead workspace',
]) {
  if (!leadOwnerIntegrity.includes(required)) throw new Error(`Missing lead-owner workspace guard: ${required}`)
}

