import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { agentAlertTask, agentAlertTaskKey, findAgentAlerts, latestHeartbeats, readAlertStaleHours } from '../lib/agents/agent-alerts.ts'
import { idleEnabledWorkspaces, listEnabledAgentWorkspaces } from '../lib/agents/agent-enablement.ts'
import { assertNonProductionTarget, checkHeartbeatIsolation, checkPlannedIsolation, CONFIRM_PHRASE, verifyAgentLiveGates } from './verify-agent-live-gates.mjs'
import { createFakeSupabase } from './lib/fake-supabase.mjs'

// --- Item 8: alert rules ---------------------------------------------------------------------
const now = new Date('2026-11-04T12:00:00.000Z')
const hoursAgo = (h) => new Date(now.getTime() - h * 3_600_000).toISOString()
const heartbeats = [
  { workspace_id: 'ws-a', agent_key: 'intake_router', status: 'healthy', last_seen_at: hoursAgo(1) },
  { workspace_id: 'ws-a', agent_key: 'office_copilot', status: 'degraded', last_seen_at: hoursAgo(2) },
  { workspace_id: 'ws-a', agent_key: 'inspection_quality', status: 'healthy', last_seen_at: hoursAgo(30) },
  // An older stale row from another worker id must not hide a fresh one.
  { workspace_id: 'ws-b', agent_key: 'intake_router', status: 'healthy', last_seen_at: hoursAgo(50) },
  { workspace_id: 'ws-b', agent_key: 'intake_router', status: 'healthy', last_seen_at: hoursAgo(3) },
  // Disabled agent: degraded heartbeat but not in the enabled list -> no alert.
  { workspace_id: 'ws-b', agent_key: 'office_copilot', status: 'degraded', last_seen_at: hoursAgo(1) },
]
const enabled = [
  { workspaceId: 'ws-a', agentKey: 'intake_router' },
  { workspaceId: 'ws-a', agentKey: 'office_copilot' },
  { workspaceId: 'ws-a', agentKey: 'inspection_quality' },
  { workspaceId: 'ws-b', agentKey: 'intake_router' },
  { workspaceId: 'ws-b', agentKey: 'scheduler' }, // never ran (no heartbeat) -> no alert
]
const alerts = findAgentAlerts({ heartbeats, enabled, now })
assert.deepEqual(alerts.map((a) => `${a.workspaceId}:${a.agentKey}:${a.reason}`), [
  'ws-a:office_copilot:degraded',
  'ws-a:inspection_quality:stale',
])
assert.equal(alerts[1].ageHours, 30)
assert.equal(latestHeartbeats(heartbeats).get('ws-b\u0000intake_router').last_seen_at, hoursAgo(3))
assert.equal(findAgentAlerts({ heartbeats, enabled, now, staleHours: 72 }).length, 1, 'stale window is configurable')
assert.equal(readAlertStaleHours({}), 24)
assert.equal(readAlertStaleHours({ AGENT_ALERT_STALE_HOURS: '48' }), 48)
assert.equal(readAlertStaleHours({ AGENT_ALERT_STALE_HOURS: '0' }), 24)
assert.equal(readAlertStaleHours({ AGENT_ALERT_STALE_HOURS: 'soon' }), 24)
assert.equal(agentAlertTaskKey(alerts[0], now), 'agent-alert:office_copilot:degraded:2026-11-04')
assert.match(agentAlertTask(alerts[0]).title, /Office Copilot is failing/)
assert.match(agentAlertTask(alerts[1]).title, /quiet for over 30h/)

// Enablement: automation rule on AND settings flag not false; read errors fail closed.
{
  const fake = createFakeSupabase({
    automation_rules: [
      { workspace_id: 'ws-a', agent_key: 'inspection_quality', enabled: true },
      { workspace_id: 'ws-b', agent_key: 'inspection_quality', enabled: true },
      { workspace_id: 'ws-c', agent_key: 'inspection_quality', enabled: false },
      { workspace_id: 'ws-d', agent_key: 'inspection_quality', enabled: true },
      { workspace_id: 'ws-a', agent_key: 'office_copilot', enabled: true },
    ],
    workspace_settings: [
      { workspace_id: 'ws-b', enable_inspection_quality_agent: false },
      { workspace_id: 'ws-d', enable_inspection_quality_agent: true },
    ],
  })
  assert.deepEqual([...await listEnabledAgentWorkspaces(fake, 'inspection_quality')].sort(), ['ws-a', 'ws-d'])
  assert.deepEqual([...await listEnabledAgentWorkspaces(fake, 'office_copilot')], ['ws-a'])
  assert.deepEqual(await idleEnabledWorkspaces(fake, 'inspection_quality', ['ws-a']), ['ws-d'], 'idle heartbeats only for enabled workspaces without work')
  assert.equal(fake.writes.length, 0)
  const failing = { from: () => ({ select() { return this }, eq() { return this }, limit() { return Promise.resolve({ data: null, error: { message: 'boom' } }) } }) }
  assert.equal((await listEnabledAgentWorkspaces(failing, 'intake_router')).size, 0)
}

// Alert route: free, in-app only, dry-run safe, no stacking.
const alertRoute = readFileSync('app/api/cron/agent-alerts/route.ts', 'utf8')
assert.ok(alertRoute.includes('agentKey: null'), 'alerts route writes no heartbeats')
assert.ok(alertRoute.includes('supportsDryRun: true'))
assert.ok(alertRoute.indexOf("if (dryRun) return NextResponse.json({ dryRun: true") < alertRoute.indexOf(".from('tasks').insert("), 'dry-run must return before any write')
assert.ok(alertRoute.includes(".like('automation_key', `agent-alert:${alert.agentKey}:%`)"), 'must not stack alerts while one is open')
assert.ok(alertRoute.includes("insertError.code !== '23505'"))
for (const forbidden of ['twilio', 'resend', 'sendgrid', 'nodemailer', 'fetch(', 'RESEND_API_KEY', 'SMTP']) {
  assert.ok(!alertRoute.toLowerCase().includes(forbidden.toLowerCase()), `alerts must stay free/in-app (${forbidden})`)
}
const daily = readFileSync('app/api/cron/daily/route.ts', 'utf8')
assert.ok(daily.lastIndexOf("invoke('agent_alerts', runAgentAlerts, request)") > daily.indexOf("invoke('warranty_expiry', runWarrantyExpiry, request)"), 'alerts run after the agent jobs')
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
assert.ok((vercel.crons ?? []).length <= 2, 'Hobby plan: at most two crons')
for (const [file, agent] of [
  ['app/api/cron/intake-router/route.ts', 'intake_router'],
  ['app/api/cron/office-copilot/route.ts', 'office_copilot'],
  ['app/api/cron/inspection-quality/route.ts', 'inspection_quality'],
  ['app/api/cron/receptionist-followups/route.ts', 'scheduler'],
]) {
  const source = readFileSync(file, 'utf8')
  assert.ok(source.includes(`idleEnabledWorkspaces(admin, '${agent}', workspaceIds), 'healthy', { idle: true })`), `${file} must heartbeat idle enabled workspaces`)
}

// --- Item 5: verify-agent-live-gates.mjs ------------------------------------------------------
const okEnv = {
  ROOF_AGENT_GATES_NONPROD: 'true',
  ROOF_AGENT_GATES_CONFIRM: CONFIRM_PHRASE,
  ROOF_AGENT_GATES_BASE_URL: 'http://127.0.0.1:1/',
  CRON_SECRET: 'local-test',
}
assert.deepEqual(assertNonProductionTarget(okEnv), { baseUrl: 'http://127.0.0.1:1', secret: 'local-test', minWorkspaces: 2 })
assert.throws(() => assertNonProductionTarget({ ...okEnv, ROOF_AGENT_GATES_NONPROD: undefined }), /NONPROD/)
assert.throws(() => assertNonProductionTarget({ ...okEnv, ROOF_AGENT_GATES_CONFIRM: 'yes' }), /CONFIRM/)
assert.throws(() => assertNonProductionTarget({ ...okEnv, ROOF_AGENT_GATES_BASE_URL: 'https://roof-os-lemon.vercel.app' }), /production host/)
assert.throws(() => assertNonProductionTarget({ ...okEnv, ROOF_AGENT_GATES_BASE_URL: 'https://app.example.com', ROOF_PRODUCTION_HOSTS: 'app.example.com' }), /production host/)
assert.throws(() => assertNonProductionTarget({ ...okEnv, CRON_SECRET: ' ' }), /CRON_SECRET/)

const lead = (ws, id) => ({
  workspaceId: ws, leadId: id, eventKey: `intake-router:${id}:t`, batchKey: `intake:${id}:intake-router:${id}:t`,
  actions: [{ kind: 'create_task', subjectId: id, idempotencyKey: `intake-first-response:${id}`, payload: { leadId: id } }],
})
assert.deepEqual(checkPlannedIsolation('intake-router', [lead('ws-a', 'l1'), lead('ws-b', 'l2')], 'leadId'), [])
const leaked = lead('ws-a', 'l1'); leaked.actions[0].payload.leadId = 'l2'
assert.equal(checkPlannedIsolation('intake-router', [leaked], 'leadId').length, 1)
assert.equal(checkPlannedIsolation('intake-router', [lead('ws-a', 'l1'), lead('ws-a', 'l1')], 'leadId').length, 1)
const report = (ids) => ({ boundary: 'heartbeat-only', workspaceCount: ids.length, agents: [{ agentKey: 'intake_router', workspaces: ids.map((workspaceId) => ({ workspaceId })) }] })
assert.deepEqual(checkHeartbeatIsolation(report(['ws-a', 'ws-b']), 2), [])
assert.equal(checkHeartbeatIsolation(report(['ws-a']), 2).length, 1)
assert.equal(checkHeartbeatIsolation({ ...report(['ws-a', 'ws-b']), agents: [{ agentKey: 'x', workspaces: [{ workspaceId: 'ws-a' }, { workspaceId: 'ws-a' }] }] }, 2).length, 1)

async function withServer(routes, run) {
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, auth: req.headers.authorization })
    const handler = routes[req.url]
    const [status, body] = handler ? handler() : [404, { error: 'not found' }]
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    return await run(`http://127.0.0.1:${server.address().port}`, requests)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const healthyRoutes = {
  '/api/cron/agent-alerts?dryRun=1': () => [200, { dryRun: true, checked: 4, alerts: [], created: 0 }],
  '/api/cron/intake-router?dryRun=1': () => [200, { dryRun: true, processed: 2, skipped: 1, alreadyProcessed: 0, failed: 0, failures: [], planned: [lead('ws-a', 'l1'), lead('ws-b', 'l2')] }],
  '/api/cron/office-copilot?dryRun=1': () => [200, { dryRun: true, processed: 0, skipped: 3, alreadyProcessed: 0, failed: 0, failures: [], planned: [] }],
  '/api/cron/heartbeat': () => [503, { ...report(['ws-a', 'ws-b']), notReady: ['intake_router'] }],
}
await withServer(healthyRoutes, async (baseUrl, requests) => {
  const summary = await verifyAgentLiveGates({ baseUrl, secret: 'local-test' })
  assert.equal(summary.ok, true, JSON.stringify(summary.problems))
  assert.ok(requests.every((r) => r.method === 'GET'), 'the verifier only sends GET requests')
  assert.ok(requests.every((r) => r.auth === 'Bearer local-test'))
  assert.ok(requests.filter((r) => r.url !== '/api/cron/heartbeat').every((r) => r.url.endsWith('?dryRun=1')), 'agent routes are always called in dry-run')
  assert.equal(requests[0].url, '/api/cron/agent-alerts?dryRun=1', 'the dry-run capability gate runs first')
})

// An old deployment without dry-run support: stop before any agent route is called.
await withServer({ ...healthyRoutes, '/api/cron/agent-alerts?dryRun=1': undefined }, async (baseUrl, requests) => {
  await assert.rejects(verifyAgentLiveGates({ baseUrl, secret: 'local-test' }), /does not have dry-run support/)
  assert.deepEqual(requests.map((r) => r.url), ['/api/cron/agent-alerts?dryRun=1'])
})
// A route that ignores dryRun (no echo) stops the run immediately.
await withServer({ ...healthyRoutes, '/api/cron/intake-router?dryRun=1': () => [200, { processed: 1, failed: 0 }] }, async (baseUrl, requests) => {
  await assert.rejects(verifyAgentLiveGates({ baseUrl, secret: 'local-test' }), /did not confirm dryRun=true/)
  assert.ok(!requests.some((r) => r.url.startsWith('/api/cron/office-copilot')))
})
// Cross-workspace leak and too few workspaces are reported as failures.
await withServer({
  ...healthyRoutes,
  '/api/cron/intake-router?dryRun=1': () => [200, { dryRun: true, planned: [leaked] }],
  '/api/cron/heartbeat': () => [200, report(['ws-a'])],
}, async (baseUrl) => {
  const summary = await verifyAgentLiveGates({ baseUrl, secret: 'local-test' })
  assert.equal(summary.ok, false)
  assert.equal(summary.problems.length, 2)
})

// CLI refuses production without making a request.
const cli = spawnSync(process.execPath, ['scripts/verify-agent-live-gates.mjs'], {
  env: { ...process.env, ...okEnv, ROOF_AGENT_GATES_BASE_URL: 'https://roof-os-lemon.vercel.app' },
  encoding: 'utf8',
})
assert.equal(cli.status, 1)
assert.match(cli.stderr, /Refusing to run against production host/)
const verifier = readFileSync('scripts/verify-agent-live-gates.mjs', 'utf8')
assert.ok(!/method: '(POST|PUT|PATCH|DELETE)'/.test(verifier), 'verifier must never send a mutating method')
assert.ok(!verifier.includes('SUPABASE_SERVICE_ROLE_KEY'), 'verifier must not use database credentials')

console.log('agent-alerts-live-gates-test: PASS (alert rules, enablement, alert route contract, read-only live-gate verifier)')
