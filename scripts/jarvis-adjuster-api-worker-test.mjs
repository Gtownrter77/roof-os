import assert from 'node:assert/strict'
import {
  resolveInboundWorkspace, correlateInbound, disableDecision, deliveryWording, claimReadScope,
} from '../lib/jarvis/api/index.ts'
import { enqueueJob, writeInbound } from '../lib/jarvis/api/server.ts'
import { HANDLERS, processJob } from '../workers/jarvis-worker.ts'
import { JARVIS_JOB_TYPES } from '../lib/jarvis/types.ts'

const WORKSPACE = '44444444-4444-4444-8444-444444444444'
const OTHER = '55555555-5555-4555-8555-555555555555'
const CLAIM = '11111111-1111-4111-8111-111111111111'
const LEAD = '22222222-2222-4222-8222-222222222222'
const IDENTITY = '33333333-3333-4333-8333-333333333333'

// Critical 1: both NOT NULL columns are supplied to the RPC by the adapter.
const rpcCalls = []
const supabase = {
  rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: 'job-id', error: null } },
  from: (table) => ({
    insert: async (row) => {
      inserted.push({ table, row })
      return { data: [row], error: null }
    },
  }),
}
const inserted = []
const jobId = await enqueueJob(supabase, {
  workspaceId: WORKSPACE,
  type: 'run_claim_plan',
  payload: { claimId: CLAIM },
  claimId: CLAIM,
  leadId: LEAD,
})
assert.equal(jobId, 'job-id')
assert.equal(rpcCalls[0].name, 'jarvis_enqueue_job')
assert.match(rpcCalls[0].args.p_payload_hash, /^[0-9a-f]{64}$/)
assert.match(rpcCalls[0].args.p_idempotency_key, /^[0-9a-f]{64}$/)
assert.equal(rpcCalls[0].args.p_claim_id, CLAIM)
assert.equal(rpcCalls[0].args.p_lead_id, LEAD)

// Critical 5: an inbound webhook never writes to a claim in another workspace.
const config = { webhookWorkspaceId: WORKSPACE, identityId: IDENTITY }
const cross = await writeInbound(supabase, config, {
  claimWorkspaceId: OTHER,
  from: '+15552345678',
  body: 'Please call me',
  matchedLead: { workspaceId: OTHER, phone: '+15552345678' },
})
assert.equal(cross.ok, false)
assert.equal(cross.reason, 'workspace_mismatch')
assert.equal(inserted.length, 0, 'no cross-workspace message may be written')

const badContact = await writeInbound(supabase, config, {
  claimWorkspaceId: WORKSPACE,
  from: '+15551234567',
  body: 'Please call me',
  matchedLead: { workspaceId: WORKSPACE, phone: '+15552345678' },
})
assert.equal(badContact.ok, false)
assert.equal(badContact.reason, 'unmatched_sender')

const ok = await writeInbound(supabase, config, {
  claimWorkspaceId: WORKSPACE,
  from: '+15552345678',
  body: 'Please call me',
  matchedLead: { workspaceId: WORKSPACE, phone: '+15552345678' },
})
assert.equal(ok.ok, true)
assert.equal(inserted.length, 1)
assert.equal(inserted[0].table, 'adjuster_messages')
assert.equal(inserted[0].row.lead_id, '', 'claim id is never copied into the lead FK')
assert.equal(inserted[0].row.identity_id, IDENTITY)
assert.ok(inserted[0].row.idempotency_key)

assert.equal(resolveInboundWorkspace({ claimWorkspaceId: WORKSPACE, webhookWorkspaceId: WORKSPACE }).allowed, true)
assert.equal(resolveInboundWorkspace({ claimWorkspaceId: OTHER, webhookWorkspaceId: WORKSPACE }).allowed, false)
assert.equal(correlateInbound({ from: '+15552345678', matchedLead: { workspaceId: WORKSPACE, phone: '+15552345678' }, workspaceId: WORKSPACE }), true)
assert.equal(correlateInbound({ from: '+15552345678', matchedLead: { workspaceId: WORKSPACE, phone: '+15552349999' }, workspaceId: WORKSPACE }), false)
assert.equal(correlateInbound({ from: 'owner@example.com', matchedLead: { workspaceId: WORKSPACE, email: 'owner@example.com' }, workspaceId: WORKSPACE }), true)
assert.equal(correlateInbound({ from: '+15552345678', matchedLead: null, workspaceId: WORKSPACE }), false)

// Critical 4: disabling routes through the real stop RPCs, not a UI-only flag.
const claimDisable = disableDecision({ kind: 'claim', claimId: CLAIM, workspaceId: WORKSPACE })
assert.equal(claimDisable.function, 'adjuster_set_claim_disabled')
assert.equal(claimDisable.args.p_claim_id, CLAIM)
assert.equal(claimDisable.args.p_disabled, true)
const workspaceDisable = disableDecision({ kind: 'workspace', workspaceId: WORKSPACE })
assert.equal(workspaceDisable.function, 'adjuster_set_workspace_enabled')
assert.equal(workspaceDisable.args.p_enabled, false)

assert.deepEqual(claimReadScope(WORKSPACE), { workspace_id: WORKSPACE })
assert.equal(deliveryWording('sent'), 'delivered')
assert.equal(deliveryWording('delivered'), 'delivered')
assert.equal(deliveryWording('queued'), 'unknown')

// Critical 2: every job type has a real handler; none is a no-op registry.
assert.deepEqual(Object.keys(HANDLERS).sort(), [...JARVIS_JOB_TYPES].sort())
for (const type of JARVIS_JOB_TYPES) assert.equal(typeof HANDLERS[type], 'function')

const touched = []
const ctx = {
  guards: { authorize: () => { touched.push('guards'); return true } },
  gateway: { send: () => { touched.push('gateway'); return 'sent' } },
  orchestrator: { transition: () => { touched.push('orchestrator'); return 'planned' } },
  documents: { generate: () => { touched.push('documents'); return 'document' } },
  extraction: { extract: () => { touched.push('extraction'); return 'facts' } },
  sandbox: { run: () => { touched.push('sandbox'); return 'ran' } },
}
for (const type of JARVIS_JOB_TYPES) {
  await processJob({ id: 'job', type, payload: {}, claimId: CLAIM, workspaceId: WORKSPACE }, ctx)
}
assert.ok(touched.includes('gateway'))
assert.ok(touched.includes('orchestrator'))
assert.ok(touched.includes('documents'))
assert.ok(touched.includes('extraction'))
assert.ok(touched.includes('sandbox'))
assert.ok(touched.includes('guards'))
await assert.rejects(
  () => processJob({ id: 'job', type: 'unknown', payload: {} }, ctx),
  (error) => error.code === 'adjuster_error',
)

console.log('jarvis-adjuster API and worker contract passed')
