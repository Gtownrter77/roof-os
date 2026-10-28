import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/062_inspection_appointment_gate.sql')
const page = read('../app/leads/[id]/page.tsx')
const runner = read('../scripts/ci/verify-inspection-appointment-postgres.sh')
const assertions = read('../scripts/ci/inspection-appointment-assertions.sql')

// 1. Migration shape: one gate, pinned search path, appointment-scoped.
assert.ok(migration.includes('create or replace function public.enforce_inspection_appointment'), 'gate function defined')
assert.ok(/security definer set search_path = public/.test(migration), 'gate pins search_path')
assert.ok(migration.includes("if new.appointment_type <> 'inspection' or new.lead_id is null"), 'only lead inspections are gated')
assert.ok(migration.includes('before insert or update of lead_id, appointment_type, starts_at, assigned_to, status'), 'trigger covers create, reschedule and assignment')
assert.ok(migration.includes('v_lead.workspace_id is distinct from new.workspace_id'), 'lead workspace must match')
assert.ok(migration.includes('new.assigned_to := new.created_by'), 'appointment is always assigned')
assert.ok(migration.includes('An inspection must be assigned to a workspace member.'), 'assignee must be a member')
assert.ok(migration.includes("v_lead.status not in ('qualified', 'inspection_scheduled')"), 'qualification gate')
assert.ok(migration.includes('This lead already has a scheduled inspection.'), 'one scheduled inspection per lead')
assert.ok(migration.includes("using errcode = '23505'"), 'duplicate inspection is a unique violation')
assert.ok(migration.includes('next_action_owner_id = new.assigned_to'), 'next action owner follows the appointment')
assert.ok(migration.includes('next_action_due = new.starts_at'), 'next action due follows the appointment start')
assert.ok(!/drop trigger if exists lead_status_history_trigger/.test(migration), 'status history trigger is preserved')
assert.ok(!/update public\.appointments/.test(migration), 'gate does not rewrite appointments')

// 2. Page: the database is the single writer of the handoff.
assert.ok(page.includes("appointment_type: 'inspection'"), 'page books an inspection')
assert.ok(page.includes('assigned_to: user.id'), 'page assigns the booking to the signed-in user')
assert.ok(!/status: 'inspection_scheduled'/.test(page), 'page no longer writes the lead status itself')
assert.ok(!/next_action_due: start\.toISOString\(\)/.test(page), 'page no longer writes the next action itself')
assert.ok(page.includes('Mark the lead qualified before scheduling an inspection.'), 'unqualified booking is explained')
assert.ok(page.includes('already has a scheduled inspection'), 'duplicate booking is explained')
assert.ok(page.includes('type Appointment'), 'page reads appointments')
assert.ok(page.includes('activeInspection'), 'page shows the active inspection')
assert.ok(page.includes("assigned_to === currentUserId ? 'you' : 'another member'"), 'assignee is visible')
assert.ok(/role="alert"/.test(read('../app/leads/new/page.tsx')), 'new-lead duplicate path keeps an alert')

// 3. Real PostgreSQL assertions cover gate, assignment and isolation.
assert.ok(assertions.includes('inspection_scheduled'), 'assertions check the handoff status')
assert.ok(assertions.includes('Complete inspection'), 'assertions check the next action')
assert.ok(assertions.includes('not auto-assigned'), 'assertions check auto-assignment')
assert.ok(assertions.includes('second scheduled inspection'), 'assertions check duplicate booking')
assert.ok(assertions.includes('unqualified lead'), 'assertions check the qualification gate')
assert.ok(assertions.includes('cross-workspace'), 'assertions check tenant isolation')
assert.ok(assertions.includes('non-member was assigned'), 'assertions check assignee membership')
assert.ok(assertions.includes('Generic inspection visit'), 'assertions check non-lead calendar entries')

// 4. Runner is local-only and uses a dedicated disposable database.
assert.ok(runner.includes('test "$PGHOST" = 127.0.0.1'), 'runner refuses non-local host')
assert.ok(runner.includes('roofos_inspection_ci'), 'runner uses a dedicated disposable database')
assert.ok(runner.includes('inspection-appointment-assertions.sql'), 'runner executes the assertions')
assert.ok(runner.includes('062_inspection_appointment_gate.sql'), 'runner applies migration 062')

console.log('inspection-appointment-test: PASS (qualification gate, auto-assignment, single scheduled inspection, next action owner, workspace isolation, non-lead calendar entries, local-only runner)')
