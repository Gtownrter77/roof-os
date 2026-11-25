import assert from 'node:assert/strict'
import {
  runJobWithPolicies, agentForJob, eventForJob, adjusterError,
} from '../lib/jarvis/runtime.ts'
import { JARVIS_JOB_TYPES } from '../lib/jarvis/types.ts'
import { mapJobRow } from '../lib/jarvis/api/row.ts'

const WORKSPACE = '44444444-4444-4444-8444-444444444444'
const CLAIM = '11111111-1111-4111-8111-111111111111'
const LEAD = '22222222-2222-4222-8222-222222222222'
const IDENTITY = '33333333-3333-4333-8333-333333333333'

function job(type, payload = {}) {
  return {
    id: 'job-1', workspaceId: WORKSPACE, type, status: 'queued',
    payload, payloadHash: 'a'.repeat(64), idempotencyKey: 'b'.repeat(64),
    attempts: 1, claimId: CLAIM, leadId: LEAD, runAfter: new Date().toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastError: null,
  }
}

function policy(overrides = {}) {
  return {
    claimId: CLAIM, workspaceId: WORKSPACE, status: 'planned', disabled: false,
    planOnly: true, authorized: true, adjusterEnabled: true, channel: 'sms',
    contact: '+15552345678', timeZone: 'UTC',
    consent: { smsConsent: true, emailConsent: true, voiceConsent: false, optedOutAt: null },
    leadId: LEAD, identityId: IDENTITY,
    ...overrides,
  }
}

function deps(currentPolicy, calls) {
  return {
    loadPolicy: async () => currentPolicy,
    send: async () => { calls.push('send'); return 'delivered' },
    recordNote: async (note) => { calls.push({ note }) },
    writeStatus: async (_id, status) => { calls.push({ status }) },
    documents: { generate: async () => { calls.push('documents'); return 'document' } },
    extraction: { extract: async () => { calls.push('extraction'); return 'facts' } },
    sandboxPerform: async () => { calls.push('sandbox'); return 'ran' },
    now: new Date('2026-11-24T12:00:00Z'),
  }
}

assert.equal(agentForJob(job('send_message')), 'scheduler')
assert.equal(agentForJob(job('run_claim_plan')), 'intake_router')
assert.equal(agentForJob(job('generate_document')), 'office_copilot')
assert.equal(agentForJob(job('extract_estimate')), 'inspection_quality')
assert.equal(eventForJob(job('run_claim_plan')), 'plan_created')
assert.equal(eventForJob(job('update_claim_status', { event: 'won' })), 'won')
assert.equal(eventForJob(job('sandbox_action')), null)
assert.equal(adjusterError('x').code, 'adjuster_error')

// A consented, in-window send is delivered, recorded in the thread, and moves
// the claim through the orchestrator's sole-writer transition.
const sent = []
const result = await runJobWithPolicies(job('send_message', { body: 'Plan ready' }), deps(policy(), sent))
assert.equal(result, 'delivered')
assert.ok(sent.includes('send'))

// The same guard chain works on a real snake_case database row, not only on a
// hand-built camelCase fixture.
const fromDb = mapJobRow({
  id: 'job-db', workspace_id: WORKSPACE, type: 'send_message', status: 'queued',
  payload: { claimId: CLAIM, body: 'Plan ready' }, payload_hash: 'c'.repeat(64),
  idempotency_key: 'd'.repeat(64), attempts: 0, claim_id: CLAIM, lead_id: LEAD,
  run_after: '2026-11-24T12:00:00Z', locked_by: null, locked_at: null,
  created_at: '2026-11-24T12:00:00Z', updated_at: '2026-11-24T12:00:00Z', last_error: null,
})
const fromDbCalls = []
assert.equal(await runJobWithPolicies(fromDb, deps(policy(), fromDbCalls)), 'delivered')
assert.ok(fromDbCalls.includes('send'))
const noteCall = sent.find((item) => typeof item === 'object' && item.note)
assert.equal(noteCall.note.leadId, LEAD)
assert.equal(noteCall.note.identityId, IDENTITY)
assert.equal(noteCall.note.direction, 'outbound')
assert.match(noteCall.note.idempotencyKey, /^[0-9a-f]{64}$/)

// Status changes go through the orchestrator's sole-writer transition.
const transitioned = []
assert.equal(
  await runJobWithPolicies(job('update_claim_status', { event: 'contacted' }), deps(policy(), transitioned)),
  'contacted',
)
assert.ok(transitioned.some((item) => typeof item === 'object' && item.status === 'contacted'))

// No consent: no provider call, no note, no state change.
const noConsent = []
await assert.rejects(
  () => runJobWithPolicies(job('send_message', { body: 'No consent' }), deps(
    policy({ consent: { smsConsent: false, emailConsent: false, voiceConsent: false, optedOutAt: null } }),
    noConsent,
  )),
  (error) => error.code === 'adjuster_error',
)
assert.deepEqual(noConsent, [], 'a blocked send must have zero side effects')

// Quiet hours: same consent, different instant, same block.
const quiet = []
const quietDeps = deps(policy(), quiet)
quietDeps.now = new Date('2026-11-24T20:00:00Z')
await assert.rejects(
  () => runJobWithPolicies(job('send_message', { body: 'Too late' }), quietDeps),
  (error) => error.code === 'adjuster_error',
)
assert.deepEqual(quiet, [])

// Plan-only is enforced at runtime, not just in a unit test.
const plan = []
assert.equal(await runJobWithPolicies(job('run_claim_plan'), deps(policy({ status: 'new' }), plan)), 'planned')
assert.ok(plan.some((item) => typeof item === 'object' && item.status === 'planned'))
const blockedExecution = []
await assert.rejects(
  () => runJobWithPolicies(job('extract_estimate'), deps(policy({
    status: 'contacted', authorized: false,
  }), blockedExecution)),
  (error) => error.code === 'adjuster_error' && error.message.includes('plan_only'),
)
assert.deepEqual(blockedExecution, [])

// Stop controls and capability scoping are checked before any handler runs.
for (const stopped of [
  policy({ disabled: true }),
  policy({ adjusterEnabled: false }),
]) {
  const calls = []
  await assert.rejects(
    () => runJobWithPolicies(job('generate_document'), deps(stopped, calls)),
    (error) => error.code === 'adjuster_error',
  )
  assert.deepEqual(calls, [])
}
const unscoped = []
await assert.rejects(
  () => runJobWithPolicies(job('send_message', { agentKey: 'receptionist' }), deps(policy(), unscoped)),
  (error) => error.code === 'adjuster_error',
)
assert.deepEqual(unscoped, [])

// Sandbox failure is reported honestly; unconfigured providers fail explicitly.
await assert.rejects(
  () => runJobWithPolicies(job('sandbox_action'), {
    ...deps(policy(), []),
    sandboxPerform: async () => { throw new Error('blocked by sandbox') },
  }),
  (error) => error.code === 'adjuster_error',
)
for (const type of ['generate_document', 'extract_estimate']) {
  const calls = []
  await assert.rejects(
    () => runJobWithPolicies(job(type), deps(policy(), calls)),
    (error) => error.code === 'adjuster_error' && error.message.includes('not configured for this deployment'),
  )
  assert.deepEqual(calls, [])
}
const sandboxOk = []
assert.equal(await runJobWithPolicies(job('sandbox_action'), deps(policy(), sandboxOk)), 'ran')
assert.ok(sandboxOk.includes('sandbox'))
assert.equal(JARVIS_JOB_TYPES.length, 6)

console.log('jarvis-adjuster runtime guard wiring contract passed')
