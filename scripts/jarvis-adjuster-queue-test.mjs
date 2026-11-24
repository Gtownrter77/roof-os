import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  payloadHash, idempotencyKey, enqueueShape, foreignKeysForNote, stableStringify,
} from '../lib/jarvis/queue/index.ts'
import { memoKey, appendMessage } from '../lib/jarvis/journal/index.ts'

const CLAIM = '11111111-1111-4111-8111-111111111111'
const LEAD = '22222222-2222-4222-8222-222222222222'
const IDENTITY = '33333333-3333-4333-8333-333333333333'
const WORKSPACE = '44444444-4444-4444-8444-444444444444'

assert.equal(
  stableStringify({ b: 2, a: 1 }),
  stableStringify({ a: 1, b: 2 }),
  'hash input must not depend on object key order',
)
assert.equal(payloadHash({ b: 2, a: 1 }), payloadHash({ a: 1, b: 2 }))
assert.notEqual(payloadHash({ a: 1 }), payloadHash({ a: 2 }))
assert.match(payloadHash({ a: 1 }), /^[0-9a-f]{64}$/)

const keyA = idempotencyKey({ workspaceId: WORKSPACE, type: 'run_claim_plan', claimId: CLAIM, payload: { step: 1 } })
const keyB = idempotencyKey({ workspaceId: WORKSPACE, type: 'run_claim_plan', claimId: CLAIM, payload: { step: 1 } })
const keyC = idempotencyKey({ workspaceId: WORKSPACE, type: 'update_claim_status', claimId: CLAIM, payload: { step: 1 } })
const keyD = idempotencyKey({ workspaceId: WORKSPACE, type: 'run_claim_plan', claimId: LEAD, payload: { step: 1 } })
assert.equal(keyA, keyB)
assert.notEqual(keyA, keyC)
assert.notEqual(keyA, keyD)

const shape = enqueueShape({
  workspaceId: WORKSPACE,
  type: 'run_claim_plan',
  payload: { claimId: CLAIM },
  claimId: CLAIM,
  leadId: LEAD,
})
assert.equal(typeof shape.payload_hash, 'string')
assert.ok(shape.payload_hash.length > 0, 'payload_hash is NOT NULL and must be supplied')
assert.equal(typeof shape.idempotency_key, 'string')
assert.ok(shape.idempotency_key.length > 0, 'idempotency_key is NOT NULL and must be supplied')
assert.equal(shape.payload_hash, payloadHash({ claimId: CLAIM }))
assert.equal(shape.workspace_id, WORKSPACE)
assert.equal(shape.claim_id, CLAIM)
assert.equal(shape.lead_id, LEAD)
assert.equal(shape.status, 'queued')
assert.equal(shape.attempts, 0)

// Every enqueueShape key must be a real column in migration 114.
const migration = readFileSync(new URL('../supabase/migrations/114_jarvis_adjuster.sql', import.meta.url), 'utf8')
const jobsBlock = migration.slice(
  migration.indexOf('create table if not exists public.jarvis_jobs'),
  migration.indexOf('create index if not exists jarvis_jobs_ready_idx'),
)
for (const column of Object.keys(shape)) {
  assert.match(jobsBlock, new RegExp(`\\b${column}\\b`), `enqueue column ${column} must exist in the jobs table`)
}
assert.match(jobsBlock, /payload_hash text not null/)
assert.match(jobsBlock, /idempotency_key text not null/)

// Critical finding 3: never write a claim id into a lead FK, never 'unknown'.
assert.deepEqual(
  foreignKeysForNote({ claimId: CLAIM, leadId: CLAIM, identityId: 'unknown' }),
  { leadId: '', identityId: '' },
)
assert.deepEqual(
  foreignKeysForNote({ claimId: CLAIM, leadId: LEAD, identityId: IDENTITY }),
  { leadId: LEAD, identityId: IDENTITY },
)
assert.deepEqual(
  foreignKeysForNote({ claimId: CLAIM, leadId: null, identityId: null }),
  { leadId: '', identityId: '' },
)

assert.equal(memoKey(CLAIM, '2026-11-24'), `memo:${CLAIM}:2026-11-24`)
const note = {
  workspaceId: WORKSPACE,
  claimId: CLAIM,
  identityId: IDENTITY,
  leadId: LEAD,
  channel: 'sms',
  direction: 'outbound',
  body: 'Your claim plan is ready.',
  idempotencyKey: keyA,
}
const journal = appendMessage([], note)
assert.equal(journal.added, true)
assert.equal(journal.messages.length, 1)
const again = appendMessage(journal.messages, { ...note, body: 'Should be deduped.' })
assert.equal(again.added, false)
assert.equal(again.messages.length, 1)
assert.equal(again.messages[0].body, 'Your claim plan is ready.')

console.log('jarvis-adjuster queue and journal contract passed')
