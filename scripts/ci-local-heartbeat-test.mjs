import assert from 'node:assert/strict'
import { checkLocalHeartbeat } from './ci/local-heartbeat-check.mjs'

const workspaceId = '77777777-7777-4777-8777-777777777777'

{
  const calls = []
  const client = {
    from(table) {
      calls.push(['from', table])
      return {
        select() { return this },
        eq(column, value) { calls.push(['eq', column, value]); return this },
        async then(resolve) { resolve({ data: [{ workspace_id: workspaceId, agent_key: 'ci-free-evidence', status: 'healthy' }], error: null }) },
      }
    },
  }
  let writeArgs
  const writeHeartbeats = async (...args) => { writeArgs = args; return { persisted: 1, errors: false } }
  const row = await checkLocalHeartbeat({ writeHeartbeats, client, workspaceId })
  assert.deepEqual(row, { workspace_id: workspaceId, agent_key: 'ci-free-evidence', status: 'healthy' })
  assert.equal(writeArgs[1][0], workspaceId)
  assert.equal(writeArgs[2], 'ci-free-evidence')
  assert.equal(writeArgs[3], 'healthy')
  assert.ok(calls.some((c) => c[0] === 'from' && c[1] === 'agent_worker_heartbeats'))
}

{
  const client = {
    from() {
      return {
        select() { return this },
        eq() { return this },
        async then(resolve) { resolve({ data: [], error: null }) },
      }
    },
  }
  const writeHeartbeats = async () => ({ persisted: 1, errors: false })
  await assert.rejects(
    checkLocalHeartbeat({ writeHeartbeats, client, workspaceId }),
    (error) => /no heartbeat row/i.test(String(error.message)),
  )
}

{
  const client = { from() { throw new Error('unexpected query') } }
  const writeHeartbeats = async () => ({ persisted: 0, errors: true })
  await assert.rejects(
    checkLocalHeartbeat({ writeHeartbeats, client, workspaceId }),
    (error) => /persist/i.test(String(error.message)),
  )
}

console.log('ci-local-heartbeat-test: PASS (real workspace heartbeat persisted and read back)')
