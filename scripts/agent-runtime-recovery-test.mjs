import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AGENT_RUN_STALE_AFTER_MS, isStaleRunning } from '../lib/agent-runtime-recovery.ts'

// 71: a stale `running` row must be replayable, but a live run must never be
// stolen. The decision is a pure helper so the worker and the gate share it.
const NOW = Date.parse('2026-11-22T12:00:00.000Z')
assert.equal(AGENT_RUN_STALE_AFTER_MS, 15 * 60 * 1000, 'stale window must be bounded')
assert.equal(isStaleRunning(null, NOW), true, 'a run with no start time is stale')
assert.equal(isStaleRunning('not-a-date', NOW), true, 'an unparsable start time is stale')
assert.equal(isStaleRunning(new Date(NOW - 60_000).toISOString(), NOW), false, 'a fresh run must not be requeued')
assert.equal(isStaleRunning(new Date(NOW - (AGENT_RUN_STALE_AFTER_MS + 1)).toISOString(), NOW), true, 'an old run must be requeued')

const runtime = readFileSync(new URL('../workers/agent-runtime.ts', import.meta.url), 'utf8')
assert.ok(runtime.includes("from '../lib/agent-runtime-recovery'"), 'runtime must import the recovery helper')
assert.ok(runtime.includes('isStaleRunning('), 'running rows must use the bounded staleness helper')
assert.ok(!/if \(existing\?\.status === 'running'\) return existing\s*\n/.test(runtime), 'the unconditional running early-return must be gone')
assert.ok(runtime.includes("'id,status,output,attempt,started_at'"), 'the claim must read started_at')
assert.ok(runtime.includes(".eq('status', 'running')"), 'stale requeue must be status-guarded')
assert.ok(
  runtime.includes(".eq('started_at'") || runtime.includes(".is('started_at', null)"),
  'stale requeue must be guarded by the observed start time so a live worker cannot be stolen'
)
assert.ok(runtime.includes(".update({ status: 'failed'") && runtime.includes(".select('id')"), 'the failure write must be checked')
assert.ok(/could not be recorded|could not be terminalized/i.test(runtime), 'a failed failure-write must surface an error')
assert.ok(/review task/i.test(runtime) && /taskError/.test(runtime), 'the review-task insert result must be checked')

console.log('agent-runtime-recovery-test: PASS (stale agent runs requeued, failure writes checked)')
