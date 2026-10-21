import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/agent-actions.ts', 'utf8')
const migration = readFileSync('supabase/migrations/053_agent_action_ledger.sql', 'utf8')
const route = readFileSync('app/api/agent-actions/approve/route.ts', 'utf8')
const writer = readFileSync('workers/action-batch.ts', 'utf8')
const inbox = readFileSync('app/agent-actions/page.tsx', 'utf8')
const executor = readFileSync('workers/action-executor.ts', 'utf8')
const cron = readFileSync('app/api/cron/agent-actions/route.ts', 'utf8')

for (const marker of [
  'export type AgentRiskLevel',
  'export type AgentActionKind',
  'RISK_BY_KIND',
  'ALWAYS_APPROVAL',
  'validateBatch',
  'canExecuteApprovedAction',
  'payloadHash',
  'idempotencyKey',
]) assert.ok(source.includes(marker), `policy source missing: ${marker}`)

for (const marker of [
  'create table if not exists public.agent_action_batches',
  'create table if not exists public.agent_actions',
  'create table if not exists public.agent_approval_events',
  'unique (workspace_id, idempotency_key)',
  'unique (batch_id, sequence)',
  'alter table public.agent_action_batches enable row level security',
  'alter table public.agent_actions enable row level security',
  'alter table public.agent_approval_events enable row level security',
  'agent_action_batches_select',
  'agent_actions_select',
  'agent_approval_events_select',
  'approval_token_hash',
  'approved_payload_hash',
  'create or replace function public.approve_agent_action_batch',
  'revoke all on function public.approve_agent_action_batch',
  'grant execute on function public.approve_agent_action_batch',
]) assert.ok(migration.includes(marker), `ledger migration missing: ${marker}`)

for (const marker of [
  "supabase.auth.getUser()",
  "rpc('approve_agent_action_batch'",
  'isUuid(batchId)',
  'actionIds must contain 1–200 valid UUIDs.',
  'Approval hashes are required.',
]) assert.ok(route.includes(marker), `approval route missing: ${marker}`)

for (const marker of [
  'export async function sha256Hex',
  'crypto.subtle.digest',
  'validateBatch(input)',
  "from('agent_action_batches')",
  "from('agent_actions')",
  'idempotency_key: action.idempotencyKey',
  'payload_hash: await sha256Hex(action.payload)',
]) assert.ok(writer.includes(marker), `batch writer missing: ${marker}`)

for (const marker of [
  "fetch('/api/agent-actions'",
  "fetch('/api/agent-actions/approve'",
  'Authorize ${batch.actions.length}',
  'approvedPayloadHash',
]) assert.ok(inbox.includes(marker), `approval inbox missing: ${marker}`)

for (const marker of [
  "kind === 'create_task'",
  "kind === 'assign_owner'",
  'agent-action:${action.id}',
  "status: 'executing'",
  "status: 'executed'",
  'No safe executor is registered',
]) assert.ok(executor.includes(marker), `executor missing: ${marker}`)

for (const marker of [
  "process.env.CRON_SECRET",
  "request.headers.get('authorization')?.replace(/^Bearer\\s+/i, '')",
  "eq('status', 'approved')",
  'executeApprovedBatch',
]) assert.ok(cron.includes(marker), `executor cron missing: ${marker}`)

assert.match(source, /send_message: 'customer_communication'/)
assert.match(source, /create_payment_link: 'financial'/)
assert.match(source, /request_signature: 'legal'/)
assert.match(source, /if \(action\.status !== 'approved'\) return false/)
assert.match(source, /approvedPayloadHash !== action\.payloadHash/)
assert.match(source, /duplicate idempotencyKey/)
console.log('agent-action-policy-test: PASS')
