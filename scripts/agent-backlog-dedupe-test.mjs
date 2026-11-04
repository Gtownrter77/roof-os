import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MAX_CRON_SCAN_LIMIT, readCronBatchConfig } from '../lib/agents/cron-batch-config.ts'
import {
  enabledAutomationWorkspaces,
  findProcessedEventKeys,
  latestInspectionPhotoTimes,
  selectPendingCandidates,
  selectUnprocessedCandidates,
} from '../lib/agents/cron-backlog.ts'
import { intakeFirstResponseTaskKey, planIntakeRouter, planIntakeRouterForLead } from '../workers/intake-router.ts'
import { createFakeSupabase } from './lib/fake-supabase.mjs'

// --- Item 1: the router does not duplicate the trigger's first-response task -------------
const baseInput = {
  lead: { id: 'lead-1', name: 'Taylor', address: '9 Oak Road', phone: '4045550199', email: null, ownerId: 'owner-1' },
  existingLeads: [],
  roundRobinOwnerIds: ['owner-1'],
  taskCreatorId: 'owner-1',
  now: '2026-11-04T12:00:00.000Z',
}
assert.deepEqual(planIntakeRouter(baseInput).actions.map((a) => a.kind), ['create_task'], 'no trigger task: router proposes the first-response task')
assert.deepEqual(planIntakeRouter({ ...baseInput, firstResponseTaskExists: true }).actions, [], 'trigger task exists: router skips its own')
const unowned = planIntakeRouter({ ...baseInput, lead: { ...baseInput.lead, ownerId: null }, firstResponseTaskExists: true })
assert.deepEqual(unowned.actions.map((a) => a.kind), ['assign_owner'], 'owner assignment is still proposed when the task already exists')
assert.equal(intakeFirstResponseTaskKey('lead-1'), 'intake:lead-1', 'must match the create_default_lead_followup trigger key')

const migration057 = readFileSync('supabase/migrations/057_workspace_feature_flags.sql', 'utf8')
assert.ok(migration057.includes("followup_key := 'intake:' || new.id::text"), 'trigger automation_key format must stay intake:<lead id>')

const leadTables = () => ({
  leads: [
    { id: 'lead-a', workspace_id: 'ws-a', name: 'Avery', address: '1 Elm St', phone: '4045550100', email: null, owner_id: 'owner-a' },
    { id: 'lead-b', workspace_id: 'ws-b', name: 'Blake', address: '2 Pine St', phone: '4045550111', email: null, owner_id: 'owner-b' },
  ],
  workspace_members: [
    { workspace_id: 'ws-a', user_id: 'owner-a', role: 'owner', created_at: '2026-01-01' },
    { workspace_id: 'ws-b', user_id: 'owner-b', role: 'owner', created_at: '2026-01-01' },
  ],
  tasks: [],
  agent_actions: [],
})

{
  const tables = leadTables()
  tables.tasks.push({ id: 't1', workspace_id: 'ws-a', automation_key: 'intake:lead-a' })
  const fake = createFakeSupabase(tables)
  const { plan, firstResponseTaskExists } = await planIntakeRouterForLead(fake, 'ws-a', 'lead-a', 'owner-a')
  assert.equal(firstResponseTaskExists, true)
  assert.deepEqual(plan.actions, [], 'trigger-created intake:<id> task suppresses the router task')
  assert.equal(fake.writes.length, 0)
}
{
  // A same-key task in another workspace must not suppress this workspace's task.
  const tables = leadTables()
  tables.tasks.push({ id: 't2', workspace_id: 'ws-b', automation_key: 'intake:lead-a' })
  const { plan } = await planIntakeRouterForLead(createFakeSupabase(tables), 'ws-a', 'lead-a', 'owner-a')
  assert.deepEqual(plan.actions.map((a) => a.kind), ['create_task'])
}
{
  // An action proposed by an earlier run (unique workspace_id + idempotency_key) is not re-proposed.
  const tables = leadTables()
  tables.agent_actions.push({ workspace_id: 'ws-a', idempotency_key: 'intake-first-response:lead-a', status: 'proposed' })
  tables.agent_actions.push({ workspace_id: 'ws-b', idempotency_key: 'intake-first-response:lead-b', status: 'executed' })
  const fake = createFakeSupabase(tables)
  assert.deepEqual((await planIntakeRouterForLead(fake, 'ws-a', 'lead-a', 'owner-a')).plan.actions, [])
  assert.deepEqual((await planIntakeRouterForLead(fake, 'ws-b', 'lead-b', 'owner-b')).plan.actions, [])
  assert.equal(fake.writes.length, 0)
}

// The live run must not persist an empty batch (validateBatch rejects zero actions).
const intakeWorker = readFileSync('workers/intake-router.ts', 'utf8')
const emptyIdx = intakeWorker.indexOf('if (plan.actions.length === 0) {')
const persistIdx = intakeWorker.indexOf('await persistActionBatch(supabase, {')
assert.ok(emptyIdx > 0 && emptyIdx < persistIdx, 'zero-action plans must return before persistActionBatch')
assert.ok(intakeWorker.includes('output: { ...plan, action_batch_id: null }'))

// --- Item 2 / 6: backlog-safe selection --------------------------------------------------
const config = readCronBatchConfig('inspection_quality', {})
assert.deepEqual(config, { limit: 25, scanLimit: 100, order: 'newest', ascending: false }, 'inspection quality defaults to newest-first with a 4x scan')
assert.equal(readCronBatchConfig('office_copilot', {}).order, 'newest')
assert.equal(readCronBatchConfig('office_copilot', { OFFICE_COPILOT_CRON_BATCH_LIMIT: '200' }).scanLimit, MAX_CRON_SCAN_LIMIT)
assert.equal(readCronBatchConfig('inspection_quality', { INSPECTION_QUALITY_CRON_ORDER: 'oldest' }).ascending, true)

{
  // 40 already-processed inspections ahead of 5 new ones: oldest-first top-25 would only see processed ones.
  const candidates = []
  const agentRuns = []
  for (let i = 0; i < 40; i += 1) {
    candidates.push({ id: `old-${i}`, workspaceId: 'ws-a', eventKey: `inspection-quality:old-${i}:t` })
    agentRuns.push({ workspace_id: 'ws-a', agent_key: 'inspection_quality', event_key: `inspection-quality:old-${i}:t`, status: i % 2 ? 'succeeded' : 'needs_review' })
  }
  for (let i = 0; i < 5; i += 1) candidates.push({ id: `new-${i}`, workspaceId: 'ws-a', eventKey: `inspection-quality:new-${i}:t` })
  // A failed run is retried; a success in another workspace or for another agent does not count.
  candidates.push({ id: 'failed', workspaceId: 'ws-a', eventKey: 'inspection-quality:failed:t' })
  agentRuns.push({ workspace_id: 'ws-a', agent_key: 'inspection_quality', event_key: 'inspection-quality:failed:t', status: 'failed' })
  candidates.push({ id: 'cross', workspaceId: 'ws-b', eventKey: 'inspection-quality:old-1:t' })
  agentRuns.push({ workspace_id: 'ws-a', agent_key: 'office_copilot', event_key: 'inspection-quality:new-0:t', status: 'succeeded' })

  const fake = createFakeSupabase({ agent_runs: agentRuns })
  const { pending, alreadyProcessed } = await selectUnprocessedCandidates(fake, 'inspection_quality', candidates, 25)
  assert.equal(alreadyProcessed, 40)
  assert.deepEqual(pending.map((c) => c.id), ['new-0', 'new-1', 'new-2', 'new-3', 'new-4', 'failed', 'cross'])
  assert.equal(fake.writes.length, 0, 'selection is read-only')
  assert.deepEqual(selectPendingCandidates(candidates.slice(40), new Set(), 2).pending.map((c) => c.id), ['new-0', 'new-1'], 'limit still caps the batch')
}
{
  // Event keys are chunked so large scans do not build an unbounded IN list.
  const candidates = Array.from({ length: 230 }, (_, i) => ({ workspaceId: 'ws-a', eventKey: `k-${i}` }))
  const fake = createFakeSupabase({ agent_runs: [{ workspace_id: 'ws-a', agent_key: 'scheduler', event_key: 'k-229', status: 'running' }] })
  const processed = await findProcessedEventKeys(fake, 'scheduler', candidates)
  assert.equal(processed.size, 1)
  assert.equal(fake.calls.filter((t) => t === 'agent_runs').length, 3)
}
{
  const fake = createFakeSupabase({
    inspection_photos: [
      { inspection_id: 'i1', workspace_id: 'ws-a', updated_at: '2026-11-02' },
      { inspection_id: 'i1', workspace_id: 'ws-a', updated_at: '2026-11-03' },
      { inspection_id: 'i2', workspace_id: 'ws-b', updated_at: '2026-11-09' },
    ],
  })
  const times = await latestInspectionPhotoTimes(fake, [{ id: 'i1', workspace_id: 'ws-a' }, { id: 'i2', workspace_id: 'ws-a' }])
  assert.equal(times.get('i1'), '2026-11-03')
  assert.equal(times.has('i2'), false, 'a photo row from another workspace must not drive the event key')
}

// --- Item 3: enablement (fail closed) ------------------------------------------------------
{
  const fake = createFakeSupabase({
    automation_rules: [
      { workspace_id: 'ws-a', agent_key: 'office_copilot', enabled: true },
      { workspace_id: 'ws-b', agent_key: 'office_copilot', enabled: false },
      { workspace_id: 'ws-c', agent_key: 'intake_router', enabled: true },
    ],
  })
  const enabled = await enabledAutomationWorkspaces(fake, 'office_copilot', ['ws-a', 'ws-b', 'ws-c', 'ws-a'])
  assert.deepEqual([...enabled], ['ws-a'])
  const failing = { from: () => ({ select() { return this }, eq() { return this }, in() { return Promise.resolve({ data: null, error: { message: 'boom' } }) } }) }
  assert.equal((await enabledAutomationWorkspaces(failing, 'office_copilot', ['ws-a'])).size, 0, 'read errors fail closed')
}

console.log('agent-backlog-dedupe-test: PASS (first-response dedupe, backlog selection, enablement)')
