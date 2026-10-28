#!/usr/bin/env node
import assert from 'node:assert/strict'
import { writeWorkerHeartbeats } from '../workers/heartbeat.ts'

const calls = []
const fakeClient = {
  from(table) {
    assert.equal(table, 'agent_worker_heartbeats')
    return {
      async upsert(record) {
        calls.push(record)
        if (record.workspace_id === 'w-error') return { error: { message: 'synthetic failure' } }
        if (record.workspace_id === 'w-throw') throw Error('synthetic exception')
        return { error: null }
      },
    }
  },
}
const savedId = process.env.AGENT_WORKER_ID
const savedVersion = process.env.AGENT_WORKER_VERSION
try {
  process.env.AGENT_WORKER_ID = 'synthetic-worker'
  process.env.AGENT_WORKER_VERSION = 'synthetic-v1'
  assert.deepEqual(await writeWorkerHeartbeats(fakeClient, ['', ''], 'scheduler', 'starting'), { persisted: 0, errors: false })
  assert.equal(calls.length, 0, 'empty workspaces must produce no DB calls')
  const result = await writeWorkerHeartbeats(fakeClient, ['w-one', 'w-one', '', 'w-two', 'w-error', 'w-throw'], 'inspection_quality', 'healthy', { synthetic: true })
  assert.deepEqual(result, { persisted: 2, errors: true }, 'must aggregate success and failures')
  assert.deepEqual(calls.map(x => x.workspace_id), ['w-one', 'w-two', 'w-error', 'w-throw'], 'must deduplicate nonempty workspace IDs')
  for (const record of calls) {
    assert.equal(record.agent_key, 'inspection_quality')
    assert.equal(record.worker_id, 'synthetic-worker')
    assert.equal(record.worker_version, 'synthetic-v1')
    assert.equal(record.status, 'healthy')
    assert.deepEqual(record.capabilities, { synthetic: true })
    assert.ok(!Number.isNaN(Date.parse(record.last_seen_at)), 'heartbeat must have a valid timestamp')
  }
  const degraded = await writeWorkerHeartbeats(fakeClient, ['w-one'], 'office_copilot', 'degraded')
  assert.deepEqual(degraded, { persisted: 1, errors: false })
  assert.equal(calls.at(-1).status, 'degraded')
} finally {
  if (savedId === undefined) delete process.env.AGENT_WORKER_ID
  else process.env.AGENT_WORKER_ID = savedId
  if (savedVersion === undefined) delete process.env.AGENT_WORKER_VERSION
  else process.env.AGENT_WORKER_VERSION = savedVersion
}
console.log('worker-heartbeat-runtime-test: PASS (deduplication, payload, error paths, status transitions)')
