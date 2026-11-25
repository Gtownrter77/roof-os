import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkLocalHeartbeat, CI_HEARTBEAT_AGENT_KEY } from './ci/local-heartbeat-check.mjs'
import { writeWorkerHeartbeats } from '../workers/heartbeat.ts'

const workspaceId = '77777777-7777-4777-8777-777777777777'
process.env.AGENT_WORKER_ID = 'ci-free-evidence-worker'
process.env.AGENT_WORKER_VERSION = '0.0.0-ci'

function fakeClient({ rows = [], persist = true } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      assert.equal(table, 'agent_worker_heartbeats')
      return {
        upsert(row) {
          calls.push({ upsert: row })
          return { error: persist ? null : { message: 'upsert refused' } }
        },
        select() { return this },
        eq(column, value) { calls.push({ eq: [column, value] }); return this },
        async then(resolve) {
          resolve({ data: rows, error: null })
        },
      }
    },
  }
}

{
  const schema = readFileSync(new URL('../supabase/migrations/008_claims_line_items_agent_readiness.sql', import.meta.url), 'utf8')
  const constraint = schema.match(/agent_key[^\n]*check \(agent_key in \(([^)]*)\)\)/)?.[1] ?? ''
  assert.match(constraint, new RegExp(`'${CI_HEARTBEAT_AGENT_KEY}'`), 'CI heartbeat agent key must satisfy the database constraint')
}

{
  const client = fakeClient({ rows: [{ workspace_id: workspaceId, agent_key: CI_HEARTBEAT_AGENT_KEY, status: 'healthy' }] })
  const row = await checkLocalHeartbeat({ writeHeartbeats: writeWorkerHeartbeats, client, workspaceId })
  assert.deepEqual(row, { workspace_id: workspaceId, agent_key: CI_HEARTBEAT_AGENT_KEY, status: 'healthy' })
  const upsert = client.calls.find((call) => call.upsert)?.upsert
  assert.ok(upsert, 'real worker writer did not issue an upsert')
  assert.equal(upsert.workspace_id, workspaceId)
  assert.equal(upsert.agent_key, CI_HEARTBEAT_AGENT_KEY)
  assert.equal(upsert.status, 'healthy')
  assert.equal(upsert.worker_id, 'ci-free-evidence-worker')
  assert.equal(upsert.worker_version, '0.0.0-ci')
}

{
  const client = fakeClient({ rows: [] })
  await assert.rejects(
    checkLocalHeartbeat({ writeHeartbeats: writeWorkerHeartbeats, client, workspaceId }),
    (error) => /no heartbeat row/i.test(String(error.message)),
  )
}

{
  const client = fakeClient({ rows: [], persist: false })
  await assert.rejects(
    checkLocalHeartbeat({ writeHeartbeats: writeWorkerHeartbeats, client, workspaceId }),
    (error) => /persist/i.test(String(error.message)),
  )
}

console.log('ci-local-heartbeat-test: PASS (real worker writer, schema-valid key, persisted row read back)')
