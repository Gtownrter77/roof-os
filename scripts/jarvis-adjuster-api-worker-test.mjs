import assert from 'node:assert/strict'
import {
  resolveInboundWorkspace, correlateInbound, correlateInboundToClaim,
  disableDecision, deliveryWording, claimReadScope,
} from '../lib/jarvis/api/index.ts'
import { enrollClaim, enqueueJob, writeInbound } from '../lib/jarvis/api/server.ts'
import { mapJobRow } from '../lib/jarvis/api/row.ts'
import { resolveConsent } from '../lib/jarvis/api/consent.ts'
import { isAuthorizedWorkerAuthHeader } from '../lib/jarvis/api/auth.ts'
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
  rpc: async (name, args) => {
    rpcCalls.push({ name, args })
    return { data: name === 'adjuster_enroll_claim' ? CLAIM : 'job-id', error: null }
  },
  from: (table) => ({
    insert: async (row) => {
      throw new Error(`unexpected direct insert into ${JSON.stringify(row)}`)
    },
  }),
}

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

// The authenticated enrollment path uses an RPC, not an RLS-blocked direct write.
const enrolled = await enrollClaim(supabase, { workspaceId: WORKSPACE, leadId: LEAD, identityId: IDENTITY })
assert.equal(enrolled, CLAIM)
const enrollCall = rpcCalls.at(-1)
assert.equal(enrollCall.name, 'adjuster_enroll_claim')
assert.equal(enrollCall.args.p_lead_id, LEAD)
assert.equal(enrollCall.args.p_identity_id, IDENTITY)
await enrollClaim(supabase, { workspaceId: WORKSPACE, leadId: LEAD, identityId: 'unknown' })
assert.equal(rpcCalls.at(-1).args.p_identity_id, '', 'unknown is never persisted as an identity')

// Critical 5: an inbound webhook never writes to a claim in another workspace.
const config = { webhookWorkspaceId: WORKSPACE, identityId: IDENTITY }
const writesBefore = rpcCalls.length
const cross = await writeInbound(supabase, config, {
  claimId: CLAIM,
  claimWorkspaceId: OTHER,
  claimLeadId: LEAD,
  from: '+15552345678',
  body: 'Please call me',
  matchedLead: { id: LEAD, workspaceId: OTHER, phone: '+15552345678' },
})
assert.equal(cross.ok, false)
assert.equal(cross.reason, 'workspace_mismatch')
assert.equal(rpcCalls.length, writesBefore, 'no cross-workspace write may be attempted')

const badContact = await writeInbound(supabase, config, {
  claimId: CLAIM,
  claimWorkspaceId: WORKSPACE,
  claimLeadId: LEAD,
  from: '+15551234567',
  body: 'Please call me',
  matchedLead: { id: LEAD, workspaceId: WORKSPACE, phone: '+15552345678' },
})
assert.equal(badContact.ok, false)
assert.equal(badContact.reason, 'unmatched_sender')
assert.equal(rpcCalls.length, writesBefore)

// A lead in the right workspace but not attached to this claim is rejected.
const wrongClaim = await writeInbound(supabase, config, {
  claimId: CLAIM,
  claimWorkspaceId: WORKSPACE,
  claimLeadId: OTHER,
  from: '+15552345678',
  body: 'Please call me',
  matchedLead: { id: LEAD, workspaceId: WORKSPACE, phone: '+15552345678' },
})
assert.equal(wrongClaim.ok, false)
assert.equal(wrongClaim.reason, 'unmatched_sender')
assert.equal(rpcCalls.length, writesBefore)

const ok = await writeInbound(supabase, config, {
  claimId: CLAIM,
  claimWorkspaceId: WORKSPACE,
  claimLeadId: LEAD,
  from: '+15552345678',
  body: 'Please call me',
  matchedLead: { id: LEAD, workspaceId: WORKSPACE, phone: '+15552345678' },
})
assert.equal(ok.ok, true)
assert.equal(ok.jobId, 'job-id')
const inboundCall = rpcCalls.at(-1)
assert.equal(inboundCall.name, 'adjuster_record_inbound', 'message and job are written atomically')
assert.equal(inboundCall.args.p_claim_id, CLAIM)
assert.equal(inboundCall.args.p_matched_lead_id, LEAD)
assert.equal(inboundCall.args.p_identity_id, IDENTITY)
assert.equal(inboundCall.args.p_channel, 'sms')
assert.match(inboundCall.args.p_payload_hash, /^[0-9a-f]{64}$/)
assert.match(inboundCall.args.p_idempotency_key, /^[0-9a-f]{64}$/)

assert.equal(resolveInboundWorkspace({ claimWorkspaceId: WORKSPACE, webhookWorkspaceId: WORKSPACE }).allowed, true)
assert.equal(resolveInboundWorkspace({ claimWorkspaceId: OTHER, webhookWorkspaceId: WORKSPACE }).allowed, false)
assert.equal(correlateInbound({ from: '+15552345678', matchedLead: { workspaceId: WORKSPACE, phone: '+15552345678' }, workspaceId: WORKSPACE }), true)
assert.equal(correlateInbound({ from: '+15552345678', matchedLead: { workspaceId: WORKSPACE, phone: '+15552349999' }, workspaceId: WORKSPACE }), false)
assert.equal(correlateInbound({ from: 'owner@example.com', matchedLead: { workspaceId: WORKSPACE, email: 'owner@example.com' }, workspaceId: WORKSPACE }), true)
assert.equal(correlateInbound({ from: '+15552345678', matchedLead: null, workspaceId: WORKSPACE }), false)
assert.equal(correlateInboundToClaim(LEAD, { id: LEAD }), true)
assert.equal(correlateInboundToClaim(OTHER, { id: LEAD }), false)
assert.equal(correlateInboundToClaim(LEAD, null), false)

// Critical 4: disabling routes through the real stop RPCs, not a UI-only flag.
const claimDisable = disableDecision({ kind: 'claim', claimId: CLAIM, workspaceId: WORKSPACE })
assert.equal(claimDisable.function, 'adjuster_set_claim_disabled')
assert.equal(claimDisable.args.p_claim_id, CLAIM)
assert.equal(claimDisable.args.p_disabled, true)
const workspaceDisable = disableDecision({ kind: 'workspace', workspaceId: WORKSPACE })
assert.equal(workspaceDisable.function, 'adjuster_set_workspace_enabled')
assert.equal(workspaceDisable.args.p_enabled, false)

assert.deepEqual(claimReadScope(WORKSPACE), { workspace_id: WORKSPACE })
assert.equal(deliveryWording('sent'), 'unknown', 'sent is not proof of delivery')
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

// Critical (fresh review): real PostgREST rows are snake_case. A wrong cast
// would leave every job with an undefined claim id and fail closed forever.
const now = new Date('2026-11-24T12:00:00Z')
const dbRow = {
  id: 'job-db', workspace_id: WORKSPACE, type: 'send_message', status: 'queued',
  payload: { claimId: CLAIM }, payload_hash: 'c'.repeat(64), idempotency_key: 'd'.repeat(64),
  attempts: 0, claim_id: CLAIM, lead_id: LEAD, run_after: now.toISOString(),
  locked_by: null, locked_at: null, created_at: now.toISOString(), updated_at: now.toISOString(),
  last_error: null,
}
const mapped = mapJobRow(dbRow)
assert.equal(mapped.id, 'job-db')
assert.equal(mapped.workspaceId, WORKSPACE, 'workspace_id must not be lost in the cast')
assert.equal(mapped.claimId, CLAIM, 'claim_id must reach the runtime as a UUID')
assert.equal(mapped.leadId, LEAD)
assert.equal(mapped.payloadHash, 'c'.repeat(64))
assert.equal(mapped.runAfter, now.toISOString())
assert.equal(mapped.lastError, null)
assert.throws(() => mapJobRow({ ...dbRow, workspace_id: undefined }), (error) => error.code === 'adjuster_error')
assert.throws(() => mapJobRow({ ...dbRow, type: 'teleport' }), (error) => error.code === 'adjuster_error')

// Important (fresh review): revocation wins over older grants, expired grants
// are ignored, and consent is bound to the normalized contact.
const consentRows = [
  { channel: 'sms', state: 'granted', phone: '+15552345678', captured_at: '2026-01-01T00:00:00Z' },
]
assert.equal(resolveConsent(consentRows, 'sms', '+15552345678', now).smsConsent, true)
const revoked = resolveConsent([
  ...consentRows,
  { channel: 'sms', state: 'revoked', phone: '(555) 234-5678', captured_at: '2026-02-01T00:00:00Z' },
], 'sms', '+15552345678', now)
assert.equal(revoked.smsConsent, false, 'a revocation overrides an older grant')
assert.equal(revoked.optedOutAt, '2026-02-01T00:00:00Z')
assert.equal(resolveConsent([
  { channel: 'sms', state: 'granted', phone: '+15552345678', expires_at: '2026-01-02T00:00:00Z' },
], 'sms', '+15552345678', now).smsConsent, false, 'expired grants do not authorize a send')
assert.equal(resolveConsent(consentRows, 'sms', '+15559990000', now).smsConsent, false)
assert.equal(resolveConsent(consentRows, 'sms', 'not-a-phone', now).smsConsent, false)
assert.equal(resolveConsent([
  { channel: 'email', state: 'granted', phone: 'owner@example.com', captured_at: '2026-01-01T00:00:00Z' },
], 'email', 'OWNER@example.com', now).emailConsent, true)
assert.equal(resolveConsent([
  { channel: 'email', state: 'granted', phone: 'owner@example.com' },
  { channel: 'email', state: 'revoked', phone: 'owner@example.com', captured_at: '2026-02-01T00:00:00Z' },
], 'email', 'owner@example.com', now).emailConsent, false)

// The daily dispatcher authenticates with CRON_SECRET; direct worker calls may
// use a dedicated secret. Either configured secret is valid, never neither.
const workerSecrets = { worker: 'worker-secret', cron: 'cron-secret' }
assert.equal(isAuthorizedWorkerAuthHeader('Bearer worker-secret', workerSecrets), true)
assert.equal(isAuthorizedWorkerAuthHeader('Bearer cron-secret', workerSecrets), true)
assert.equal(isAuthorizedWorkerAuthHeader('Bearer wrong', workerSecrets), false)
assert.equal(isAuthorizedWorkerAuthHeader(null, workerSecrets), false)
assert.equal(isAuthorizedWorkerAuthHeader('Bearer cron-secret', { worker: 'worker-secret', cron: '' }), false)
assert.equal(isAuthorizedWorkerAuthHeader('Bearer worker-secret', { worker: '', cron: 'cron-secret' }), false)

console.log('jarvis-adjuster API and worker contract passed')
