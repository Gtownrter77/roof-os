import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { AGENT_TOGGLES, mergeAgentToggles, parseAgentToggleUpdate } from '../lib/agents/agent-toggles.ts'
import { MANAGED_AGENT_KEYS } from '../lib/agents/agent-enablement.ts'
import { CRON_ALERTS_TIMEOUT_MS, DEFAULT_CRON_JOB_TIMEOUT_MS, cronJobTimeoutMs } from '../lib/agents/cron-batch-config.ts'

const read = (path) => readFileSync(path, 'utf8')

// 1. Agent switches cover every managed agent and report unseeded rows as unknown, not "on".
assert.deepEqual(AGENT_TOGGLES.map((toggle) => toggle.agentKey), MANAGED_AGENT_KEYS)
const merged = mergeAgentToggles([
  { agent_key: 'intake_router', enabled: true, updated_at: '2026-11-03T00:00:00Z' },
  { agent_key: 'office_copilot', enabled: false },
  { agent_key: 'not_an_agent', enabled: true },
])
assert.equal(merged.length, 4)
assert.equal(merged.find((agent) => agent.agentKey === 'intake_router').enabled, true)
assert.equal(merged.find((agent) => agent.agentKey === 'office_copilot').enabled, false)
assert.equal(merged.find((agent) => agent.agentKey === 'scheduler').enabled, null)
assert.equal(mergeAgentToggles(null).every((agent) => agent.enabled === null), true)

assert.deepEqual(parseAgentToggleUpdate({ agent_key: 'scheduler', enabled: false }), { agentKey: 'scheduler', enabled: false })
for (const bad of [null, [], {}, { agent_key: 'scheduler' }, { agent_key: 'scheduler', enabled: 'false' }, { agent_key: 'drop table', enabled: true }]) {
  assert.ok('error' in parseAgentToggleUpdate(bad), `rejects ${JSON.stringify(bad)}`)
}

// 2. The settings route writes through the user's client, so automation_rules RLS applies.
const route = read('app/api/settings/agents/route.ts')
assert.ok(route.includes("from '../../../../lib/supabase/server'"), 'agent switches must use the signed-in user client')
assert.ok(!route.includes('createAdminClient') && !route.includes('service_role') && !route.includes('SERVICE_ROLE'), 'agent switches must never use the service role')
assert.ok(route.includes('is_workspace_admin'), 'agent switches require workspace administration')
assert.ok(route.includes('is_system_owner'), 'the UI is told whether writes are allowed')
assert.ok(route.indexOf('is_workspace_admin') < route.indexOf(".update("), 'admin check runs before the write')
assert.ok(route.includes(".eq('workspace_id', workspaceId)") && route.includes(".eq('agent_key', update.agentKey)"), 'writes are scoped to one workspace and agent')
assert.ok(route.includes('data.length === 0') && route.includes('status: 403'), 'an RLS-filtered write is reported as 403, not success')
assert.ok(!route.includes('.insert(') && !route.includes('.upsert(') && !route.includes('.delete('), 'agent switches only flip existing rules')
const page = read('app/settings/page.tsx')
assert.ok(page.includes('<AgentSwitches />'), 'the settings screen shows the agent switches')
const component = read('components/AgentSwitches.tsx')
assert.ok(component.includes("'/api/settings/agents'") && component.includes("method: 'PUT'"), 'switches save through the settings route')
assert.ok(component.includes('disabled={!canEdit'), 'switches are read-only for non-owners')

// 3. The daily dispatcher isolates each job with allSettled and a per-job deadline.
const daily = read('app/api/cron/daily/route.ts')
assert.ok(daily.includes('Promise.allSettled'), 'daily dispatcher must use Promise.allSettled')
assert.ok(!/Promise\.all\(/.test(daily), 'daily dispatcher must not use Promise.all')
assert.ok(daily.includes('Promise.race([work, timeout])') && daily.includes('status: 504'), 'a slow job becomes a 504 entry')
assert.ok(daily.includes('clearTimeout(timer)'), 'the deadline timer is always cleared')
assert.equal(cronJobTimeoutMs({}), DEFAULT_CRON_JOB_TIMEOUT_MS)
assert.equal(cronJobTimeoutMs({ AGENT_CRON_JOB_TIMEOUT_MS: 'abc' }), DEFAULT_CRON_JOB_TIMEOUT_MS)
assert.equal(cronJobTimeoutMs({ AGENT_CRON_JOB_TIMEOUT_MS: '-5' }), DEFAULT_CRON_JOB_TIMEOUT_MS)
assert.equal(cronJobTimeoutMs({ AGENT_CRON_JOB_TIMEOUT_MS: '10' }), 1_000)
assert.equal(cronJobTimeoutMs({ AGENT_CRON_JOB_TIMEOUT_MS: '9999999' }), 290_000)
assert.equal(cronJobTimeoutMs({ AGENT_CRON_JOB_TIMEOUT_MS: '30000' }), 30_000)
assert.ok(DEFAULT_CRON_JOB_TIMEOUT_MS + CRON_ALERTS_TIMEOUT_MS < 60_000, 'default deadlines fit a 60s Hobby function')

// 4. The optional GitHub schedule is free, no-ops without secrets, and never logs response details.
const workflow = read('.github/workflows/agent-cron-schedule.yml')
assert.ok(workflow.includes('schedule:') && workflow.includes('workflow_dispatch:'))
assert.ok(workflow.includes('secrets.ROOF_OS_CRON_URL') && workflow.includes('secrets.ROOF_OS_CRON_SECRET'))
assert.ok(/if \[ -z "\$\{ROOF_OS_CRON_URL:-\}" \] \|\| \[ -z "\$\{ROOF_OS_CRON_SECRET:-\}" \]; then[\s\S]*?exit 0/.test(workflow), 'missing secrets must exit 0')
assert.ok(workflow.includes('/api/cron/daily'), 'the schedule only calls the daily dispatcher')
assert.ok(!workflow.includes('cat /tmp/daily.json') && !workflow.includes('head -c'), 'public logs must not print the response body')
assert.ok(workflow.includes('permissions:\n  contents: read'))
assert.ok(!workflow.includes('push:') && !workflow.includes('pull_request:'), 'the schedule must not run on pushes or PRs')
const vercel = JSON.parse(read('vercel.json'))
assert.ok((vercel.crons ?? []).length <= 2, 'vercel.json stays within the Hobby cron limit')

console.log('agent-toggles-daily-test: PASS (agent switches, RLS-respecting route, allSettled daily, optional free schedule)')
