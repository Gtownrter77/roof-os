import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const helper = readFileSync('workers/heartbeat.ts', 'utf8')
assert.ok(helper.includes('agent_worker_heartbeats'))
assert.ok(helper.includes("status: HeartbeatStatus"))
assert.ok(helper.includes('last_seen_at'))
assert.ok(helper.includes('return { persisted: 0, errors: false }'))
assert.ok(helper.includes('results.some((success) => !success)'))

const routes = [
  ['app/api/cron/agent-actions/route.ts', 'office_copilot'],
  ['app/api/cron/inspection-quality/route.ts', 'inspection_quality'],
  ['app/api/cron/intake-router/route.ts', 'intake_router'],
  ['app/api/cron/office-copilot/route.ts', 'office_copilot'],
  ['app/api/cron/receptionist-followups/route.ts', 'scheduler'],
  ['app/api/cron/retailer-prices/route.ts', 'scheduler'],
]
for (const [file, agent] of routes) {
  const source = readFileSync(file, 'utf8')
  const viaWrapper = source.includes("lib/agents/cron-route") && source.includes(`agentKey: '${agent}'`)
  assert.ok(source.includes("workers/heartbeat") || viaWrapper, `${file} must import heartbeat helper or the shared cron wrapper`)
  assert.ok(source.includes(`'${agent}'`), `${file} must identify ${agent}`)
  assert.ok(source.includes("'starting'"), `${file} must record starting state`)
  assert.ok(source.includes("'healthy'") && source.includes("'degraded'"), `${file} must report outcome state`)
}
// Disabled agents write no heartbeats: the heartbeat status enum has no 'disabled' value
// (starting/healthy/degraded/stopped), so routes heartbeat only enabled workspaces with work.
const enabledOnly = [
  ['app/api/cron/intake-router/route.ts', 'const workspaceIds = selection.pending.map((candidate) => candidate.workspaceId)'],
  ['app/api/cron/office-copilot/route.ts', 'const workspaceIds = selection.pending.map((candidate) => candidate.workspaceId)'],
  ['app/api/cron/inspection-quality/route.ts', 'const workspaceIds = selection.pending.map((candidate) => candidate.workspaceId)'],
  ['app/api/cron/receptionist-followups/route.ts', 'const workspaceIds = attempts.map((attempt) => attempt.workspace_id)'],
  ['app/api/cron/agent-actions/route.ts', '.filter((workspaceId) => enabledWorkspaces.has(workspaceId))'],
]
for (const [file, marker] of enabledOnly) {
  const source = readFileSync(file, 'utf8')
  assert.ok(source.includes(marker), `${file} must derive heartbeat workspaces from enabled workspaces only`)
  const markerIdx = source.indexOf(marker)
  const startIdx = source.search(/eartbeats?\((admin, )?workspaceIds, ('office_copilot', )?'starting'/)
  assert.ok(markerIdx > 0 && markerIdx < startIdx, `${file} must filter to enabled workspaces before the starting heartbeat`)
}
const receptionist = readFileSync('app/api/cron/receptionist-followups/route.ts', 'utf8')
assert.ok(receptionist.includes('.filter((attempt) => receptionistEnabled(attempt.workspace_id)).slice(0, batch.limit)'), 'scheduler must drop disabled workspaces before applying the batch limit')
const heartbeatMigration = readFileSync('supabase/migrations/' + readdirSync('supabase/migrations').find((name) => readFileSync('supabase/migrations/' + name, 'utf8').includes('create table if not exists public.agent_worker_heartbeats')), 'utf8')
assert.ok(heartbeatMigration.includes("'starting','healthy','degraded','stopped'") || heartbeatMigration.includes("'starting', 'healthy', 'degraded', 'stopped'"), 'heartbeat status enum is unchanged (no disabled state)')

const wrapper = readFileSync('lib/agents/cron-route.ts', 'utf8')
assert.ok(wrapper.includes("from '../../workers/heartbeat'"), 'cron wrapper must use the shared heartbeat helper')
const status = readFileSync('app/api/status/route.ts', 'utf8')
assert.ok(status.includes('agent_worker_heartbeats'))
assert.ok(status.includes('15 * 60 * 1000'))
assert.ok(status.includes("status: 'unknown'"))
assert.ok(status.includes("order('last_seen_at'"))
assert.ok(status.includes('queryError'))
console.log('worker-heartbeat-contract-test: PASS')
