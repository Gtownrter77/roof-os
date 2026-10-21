import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helper = readFileSync('workers/heartbeat.ts', 'utf8')
assert.ok(helper.includes('agent_worker_heartbeats'))
assert.ok(helper.includes("status: HeartbeatStatus"))
assert.ok(helper.includes('last_seen_at'))
assert.ok(helper.includes('must never turn an otherwise bounded cron'))

const routes = [
  ['app/api/cron/agent-actions/route.ts', 'office_copilot'],
  ['app/api/cron/inspection-quality/route.ts', 'inspection_quality'],
  ['app/api/cron/receptionist-followups/route.ts', 'scheduler'],
  ['app/api/cron/retailer-prices/route.ts', 'scheduler'],
]
for (const [file, agent] of routes) {
  const source = readFileSync(file, 'utf8')
  assert.ok(source.includes("workers/heartbeat"), `${file} must import heartbeat helper`)
  assert.ok(source.includes(`'${agent}'`), `${file} must identify ${agent}`)
  assert.ok(source.includes("'starting'"), `${file} must record starting state`)
  assert.ok(source.includes("'healthy'") && source.includes("'degraded'"), `${file} must report outcome state`)
}
const status = readFileSync('app/api/status/route.ts', 'utf8')
assert.ok(status.includes('agent_worker_heartbeats'))
assert.ok(status.includes('15 * 60 * 1000'))
assert.ok(status.includes("status: 'unknown'"))
console.log('worker-heartbeat-contract-test: PASS')
