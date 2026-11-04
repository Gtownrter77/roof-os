import assert from 'node:assert/strict'
import { isCronAuthorized, isDryRunRequested, parseDryRunBody, readSupabaseWorkerConfig, readWorkerIdentity } from '../lib/agents/cron-guard.ts'
import { DEFAULT_CRON_BATCH_LIMIT, MAX_CRON_BATCH_LIMIT, readCronBatchConfig } from '../lib/agents/cron-batch-config.ts'
import { planIntakeRouterForLead, intakeRouterBatchKey } from '../workers/intake-router.ts'
import { planOfficeCopilotForInspection, officeCopilotBatchKey } from '../workers/office-copilot.ts'
import { createFakeSupabase } from './lib/fake-supabase.mjs'

// 1. CRON_SECRET bearer guard fails closed (401 contract).
assert.equal(isCronAuthorized('Bearer s3cret', { CRON_SECRET: 's3cret' }), true)
assert.equal(isCronAuthorized('bearer s3cret', { CRON_SECRET: ' s3cret ' }), true)
assert.equal(isCronAuthorized('s3cret', { CRON_SECRET: 's3cret' }), true, 'raw token is accepted as before')
assert.equal(isCronAuthorized('Bearer wrong', { CRON_SECRET: 's3cret' }), false)
assert.equal(isCronAuthorized(null, { CRON_SECRET: 's3cret' }), false)
assert.equal(isCronAuthorized('Bearer ', { CRON_SECRET: '' }), false, 'unset secret must never authorize')
assert.equal(isCronAuthorized('Bearer undefined', {}), false)

// 2. Service-role worker config (503 contract).
assert.equal(readSupabaseWorkerConfig({}), null)
assert.equal(readSupabaseWorkerConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }), null)
assert.deepEqual(readSupabaseWorkerConfig({ NEXT_PUBLIC_SUPABASE_URL: ' https://x.supabase.co ', SUPABASE_SERVICE_ROLE_KEY: ' k ' }), { supabaseUrl: 'https://x.supabase.co', serviceRoleKey: 'k' })
assert.deepEqual(readWorkerIdentity('intake-router-v1', {}), { workerId: 'vercel-cron', workerVersion: 'intake-router-v1' })
assert.deepEqual(readWorkerIdentity('intake-router-v1', { AGENT_WORKER_ID: 'w', AGENT_WORKER_VERSION: 'v2' }), { workerId: 'w', workerVersion: 'v2' })

// 3. Dry-run flag parsing.
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router?dryRun=1'), true)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router?dryRun=true'), true)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router?dry_run=yes'), true)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router?dryRun=0'), false)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router'), false)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router', { dryRun: true }), true)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router', { dryRun: false }), false)
assert.equal(isDryRunRequested('https://roof.test/api/cron/intake-router', ['dryRun']), false)
assert.deepEqual(parseDryRunBody('{"dryRun":true}'), { dryRun: true })
assert.equal(parseDryRunBody('not json'), null)
assert.equal(parseDryRunBody('x'.repeat(5000)), null)

// 4. Batch limit/order defaults and env overrides.
assert.equal(DEFAULT_CRON_BATCH_LIMIT, 25)
assert.deepEqual(readCronBatchConfig('intake_router', {}), { limit: 25, scanLimit: 100, order: 'newest', ascending: false })
assert.equal(readCronBatchConfig('scheduler', {}).order, 'oldest')
assert.equal(readCronBatchConfig('office_copilot', { AGENT_CRON_BATCH_LIMIT: '10' }).limit, 10)
assert.equal(readCronBatchConfig('office_copilot', { AGENT_CRON_BATCH_LIMIT: '10', OFFICE_COPILOT_CRON_BATCH_LIMIT: '40' }).limit, 40, 'per-agent override wins')
assert.equal(readCronBatchConfig('office_copilot', { OFFICE_COPILOT_CRON_BATCH_LIMIT: '100000' }).limit, MAX_CRON_BATCH_LIMIT, 'limit is clamped')
assert.equal(readCronBatchConfig('office_copilot', { OFFICE_COPILOT_CRON_BATCH_LIMIT: '-3' }).limit, 25, 'invalid limit falls back')
assert.equal(readCronBatchConfig('office_copilot', { OFFICE_COPILOT_CRON_BATCH_LIMIT: '2.5' }).limit, 25, 'non-integer limit falls back')
assert.equal(readCronBatchConfig('office_copilot', { OFFICE_COPILOT_CRON_BATCH_LIMIT: '100' }).scanLimit, MAX_CRON_BATCH_LIMIT)
assert.equal(readCronBatchConfig('scheduler', { SCHEDULER_CRON_ORDER: 'newest' }).ascending, false)
assert.equal(readCronBatchConfig('intake_router', { INTAKE_ROUTER_CRON_ORDER: 'sideways' }).order, 'newest', 'invalid order falls back')

// 5. Dry-run planners are read-only and workspace scoped.
const tables = {
  leads: [
    { id: 'lead-a', workspace_id: 'ws-a', name: 'Avery', address: '1 Elm St', phone: '4045550100', email: null, owner_id: 'owner-a' },
    { id: 'lead-dup', workspace_id: 'ws-b', name: 'Other', address: '1 Elm St', phone: '4045550100', email: null, owner_id: 'owner-b' },
  ],
  workspace_members: [
    { workspace_id: 'ws-a', user_id: 'owner-a', role: 'owner', created_at: '2026-01-01' },
    { workspace_id: 'ws-b', user_id: 'owner-b', role: 'owner', created_at: '2026-01-01' },
  ],
  inspection_sessions: [
    { id: 'insp-a', workspace_id: 'ws-a', lead_id: 'lead-a', status: 'completed' },
    { id: 'insp-open', workspace_id: 'ws-a', lead_id: 'lead-a', status: 'in_progress' },
  ],
  inspection_photos: [
    { id: 'p1', inspection_id: 'insp-a', workspace_id: 'ws-a', album: 'before', caption: 'Front', upload_status: 'uploaded', object_path: 'a/1.jpg', created_at: '1' },
  ],
  lead_activity: [],
}
const fake = createFakeSupabase(tables)
const { plan } = await planIntakeRouterForLead(fake, 'ws-a', 'lead-a', 'owner-a', '2026-11-04T00:00:00.000Z')
assert.deepEqual(plan.duplicateLeadIds, [], 'a matching lead in another workspace must not be treated as a duplicate')
assert.deepEqual(plan.actions.map((action) => action.kind), ['create_task'])
await assert.rejects(planIntakeRouterForLead(fake, 'ws-b', 'lead-a', 'owner-b'), /not found in the requested workspace/)
assert.equal(intakeRouterBatchKey('lead-a', 'intake-router:lead-a:t'), 'intake:lead-a:intake-router:lead-a:t')

const office = await planOfficeCopilotForInspection(fake, 'ws-a', 'insp-a', 'owner-a')
assert.equal(office.skipped, false)
assert.equal(office.leadName, 'Avery')
assert.equal(office.actions[0].kind, 'create_review_task')
assert.ok(office.draft.missingAlbums.includes('damage'))
assert.deepEqual(await planOfficeCopilotForInspection(fake, 'ws-a', 'insp-open', 'owner-a'), { skipped: true, reason: 'inspection_not_completed' })
await assert.rejects(planOfficeCopilotForInspection(fake, 'ws-b', 'insp-a', 'owner-b'), /not found in the requested workspace/)
assert.equal(officeCopilotBatchKey('insp-a', 'k'), 'office-copilot-review:insp-a:k')
assert.equal(fake.writes.length, 0, 'dry-run planners must never write')
assert.ok(!fake.calls.includes('agent_worker_heartbeats') && !fake.calls.includes('agent_runs') && !fake.calls.includes('agent_action_batches'), 'planners must not touch heartbeats, runs, or batches')

console.log('agent-cron-helpers-test: PASS (auth guard, config, dry-run parsing, batch config, read-only planners)')
