import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  approvedBatchRejection,
  isStaleExecuting,
  statusWriteSucceeded,
} from '../lib/agent-action-recovery.ts'

// 61: a rejected approved batch must transition to a terminal status before the
// executor throws, otherwise the cron keeps re-selecting the same poison rows.
assert.deepEqual(approvedBatchRejection('expired'), { status: 'expired', message: 'Action batch has expired' })
assert.equal(approvedBatchRejection('payload_hash_mismatch').status, 'failed')
assert.equal(approvedBatchRejection('binding_mismatch').status, 'failed')
assert.ok(approvedBatchRejection('binding_mismatch').message.length > 0, 'rejection must carry a reason')

// 61: orphaned `executing` batches are safe to replay only after a bounded staleness
// window; a batch that never recorded a start time is immediately stale.
const NOW = Date.parse('2026-11-22T12:00:00.000Z')
const STALE = 15 * 60 * 1000
assert.equal(isStaleExecuting(null, NOW, STALE), true)
assert.equal(isStaleExecuting('not-a-date', NOW, STALE), true)
assert.equal(isStaleExecuting(new Date(NOW - 60_000).toISOString(), NOW, STALE), false)
assert.equal(isStaleExecuting(new Date(NOW - (STALE + 1)).toISOString(), NOW, STALE), true)

// 62: a discarded status write must never be treated as a successful ledger write.
assert.equal(statusWriteSucceeded({ error: null, data: [{ id: 'a' }] }, true).ok, true)
assert.equal(statusWriteSucceeded({ error: { message: 'db down' }, data: null }, true).ok, false)
assert.equal(statusWriteSucceeded({ error: null, data: [] }, true).ok, false)
assert.equal(statusWriteSucceeded({ error: null, data: null }, false).ok, true)

const executor = readFileSync(new URL('../workers/action-executor.ts', import.meta.url), 'utf8')
assert.ok(executor.includes("from '../lib/agent-action-recovery'"), 'executor must import the recovery helpers')
assert.ok(executor.includes('approvedBatchRejection('), 'executor must transition rejected approved batches')
assert.ok(executor.includes('statusWriteSucceeded('), 'executor must check every ledger status write')
assert.ok((executor.match(/\.select\('id'\)/g) ?? []).length >= 3, 'executor status writes must select affected rows')
assert.ok(executor.includes('export async function requeueStaleExecutingBatches'), 'executor must expose an orphan reaper')
assert.ok(executor.includes("isStaleExecuting("), 'reaper must use the bounded staleness helper')

const cron = readFileSync(new URL('../app/api/cron/agent-actions/route.ts', import.meta.url), 'utf8')
assert.ok(cron.includes('requeueStaleExecutingBatches'), 'cron must requeue orphaned executing batches')
assert.ok(cron.indexOf('await requeueStaleExecutingBatches') < cron.indexOf(".eq('status', 'approved')"), 'reaper must run before the approved-batch select')
assert.ok(cron.includes('failures.push(...result.failures'), 'cron must surface per-action ledger write failures')

// Reviewer MEDIUM 1: housekeeping must never take down every approved batch.
const reaperAt = cron.indexOf('await requeueStaleExecutingBatches')
const reaperGuard = cron.slice(Math.max(0, reaperAt - 140), reaperAt + 300)
assert.ok(reaperGuard.includes('try {') && reaperGuard.includes('catch'), 'the reaper call must be guarded so a DB error cannot skip all approved batches')

// Reviewer LOW 3: the stale window must be a real lease with renewals, not a
// blind timeout that can requeue a still-running batch.
assert.ok(executor.includes('async function touchBatchLease'), 'executor must renew the batch lease during long runs')
assert.ok(executor.includes('lease was lost'), 'a lost lease must fail closed instead of double-executing')
assert.ok((executor.match(/return await rejectApprovedBatch\(/g) ?? []).length >= 3, 'rejection sites must explicitly terminate control flow')

// Reviewer confirmation LOW: the lease must be an optimistic-concurrency token so
// a renewal between the reaper's SELECT and UPDATE cannot requeue a live batch,
// and a re-claimed batch fails closed instead of double-executing.
assert.ok(
  /\.is\('execution_started_at',\s*null\)/.test(executor) &&
    /\.eq\('execution_started_at',\s*observedLease\)/.test(executor),
  'the reaper UPDATE must be guarded by the lease value observed in SELECT (including null)'
)
const claimAt = executor.indexOf(".update({ status: 'executing'")
assert.ok(
  executor.slice(claimAt, claimAt + 400).includes(".select('id,execution_started_at')"),
  'the claim must return its lease token'
)
assert.ok(
  /async function touchBatchLease\(\s*supabase:\s*SupabaseClient,\s*batchId:\s*string,\s*expectedLeaseAt:\s*string\s*\)/.test(executor),
  'touchBatchLease must accept an expected lease token'
)
assert.ok(
  /\.eq\('execution_started_at',\s*expectedLeaseAt\)/.test(executor),
  'lease renewal and the final write must be conditional on the expected token'
)
assert.ok(executor.includes('expectedLeaseAt = await touchBatchLease('), 'the worker must thread the renewed token forward')

console.log('agent-action-recovery-test: PASS (poison batches terminalized, orphans reaped, lease token guarded, ledger writes checked)')
