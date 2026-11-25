#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

export const CI_HEARTBEAT_AGENT_KEY = 'intake_router'

export async function checkLocalHeartbeat({ writeHeartbeats, client, workspaceId }) {
  assert.match(String(workspaceId), /^[0-9a-f-]{36}$/i, 'workspaceId must be a UUID')
  const result = await writeHeartbeats(client, [workspaceId], CI_HEARTBEAT_AGENT_KEY, 'healthy')
  assert.deepEqual(result, { persisted: 1, errors: false }, 'heartbeat did not persist cleanly')
  const { data, error } = await client
    .from('agent_worker_heartbeats')
    .select('workspace_id,agent_key,status')
    .eq('workspace_id', workspaceId)
    .eq('agent_key', CI_HEARTBEAT_AGENT_KEY)
  assert.ifError(error)
  assert.equal(data?.length, 1, 'no heartbeat row was persisted')
  assert.equal(data[0].agent_key, CI_HEARTBEAT_AGENT_KEY, 'persisted heartbeat uses the wrong agent key')
  assert.equal(data[0].status, 'healthy', 'persisted heartbeat status is not healthy')
  return data[0]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ROOF_CI_WORKSPACE_ID']) {
    assert.ok(process.env[name], `${name} is required`)
  }
  process.env.AGENT_WORKER_ID ||= 'ci-free-evidence-worker'
  process.env.AGENT_WORKER_VERSION ||= '0.0.0-ci'
  const { writeWorkerHeartbeats } = await import('../../workers/heartbeat.ts')
  const client = supabaseCreateClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const row = await checkLocalHeartbeat({ writeHeartbeats: writeWorkerHeartbeats, client, workspaceId: process.env.ROOF_CI_WORKSPACE_ID })
  console.log(`ci-local-heartbeat-check: PASS (${row.agent_key}/${row.status})`)
}
