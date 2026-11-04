import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Source contract for the Intake Router and Office Copilot cron entry points.
// Mirrors app/api/cron/inspection-quality/route.ts: CRON_SECRET auth, service config check,
// workspace-scoped reads, per-workspace enablement, heartbeats before/after, GET + POST.
const routes = [
  {
    file: 'app/api/cron/intake-router/route.ts',
    agent: 'intake_router',
    runner: 'runIntakeRouter',
    worker: "from '../../../../workers/intake-router'",
    table: ".from('leads')",
    eventKey: '`intake-router:${lead.id}:',
  },
  {
    file: 'app/api/cron/office-copilot/route.ts',
    agent: 'office_copilot',
    runner: 'runOfficeCopilot',
    worker: "from '../../../../workers/office-copilot'",
    table: ".from('inspection_sessions')",
    eventKey: '`office-copilot:${inspection.id}:',
  },
]

for (const route of routes) {
  assert.ok(existsSync(route.file), `${route.file} must exist`)
  const source = readFileSync(route.file, 'utf8')
  const has = (marker, message) => assert.ok(source.includes(marker), `${route.file}: ${message ?? marker}`)

  has("process.env.CRON_SECRET?.trim()", 'must read CRON_SECRET')
  has("if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })", 'must fail closed with 401')
  has('SUPABASE_SERVICE_ROLE_KEY', 'must require the service-role worker config')
  has('{ status: 503 }', 'must return 503 when worker config is missing')
  has('createAdminClient()')
  has(route.table, 'must read its source records')
  has('.limit(25)', 'must bound each run')
  has(route.worker, `must import ${route.runner} from its worker`)
  has(`await ${route.runner}(`, `must call ${route.runner}`)
  has(route.eventKey, 'must derive a deterministic per-record event key')

  // Per-workspace enablement through automation_rules, matching the DB follow-up trigger.
  has(".from('automation_rules')", 'must check automation_rules enablement')
  has(`.eq('agent_key', '${route.agent}')`, 'must scope automation_rules to this agent')
  has(".in('workspace_id', uniqueWorkspaceIds)", 'must scope automation_rules to the run workspaces')
  has('rule.enabled === true', 'must require an explicitly enabled rule')
  has('skipped += 1', 'must skip disabled workspaces')

  // Heartbeats before and after, with this agent's key.
  has("from '../../../../workers/heartbeat'")
  for (const state of ['starting', 'healthy', 'degraded']) {
    has(`writeWorkerHeartbeats(admin, workspaceIds, '${route.agent}', '${state}'`, `must write ${state} heartbeat`)
  }
  const startIdx = source.indexOf(`'${route.agent}', 'starting'`)
  const runIdx = source.indexOf(`await ${route.runner}(`)
  const healthyIdx = source.indexOf(`'${route.agent}', 'healthy'`)
  assert.ok(startIdx > 0 && startIdx < runIdx && runIdx < healthyIdx, `${route.file}: heartbeat order must be starting -> run -> healthy`)

  has('export async function POST(request: NextRequest)', 'must export POST')
  assert.match(source, /export const GET = POST/, `${route.file}: must export GET for Vercel Cron`)

  // Free-core / safety boundaries: no paid model keys, no direct outbound messaging.
  for (const forbidden of ['XAI_API_KEY', 'OPENAI_API_KEY', 'twilio', 'stripe', 'request.json()']) {
    assert.ok(!source.includes(forbidden), `${route.file}: must not reference ${forbidden}`)
  }
}

// Workspace-scoped photo lookup for Office Copilot event keys.
const office = readFileSync('app/api/cron/office-copilot/route.ts', 'utf8')
assert.ok(office.includes(".eq('workspace_id', inspection.workspace_id)"), 'office-copilot photo lookup must be workspace-scoped')

// Worker signatures the routes depend on.
const intakeWorker = readFileSync('workers/intake-router.ts', 'utf8')
assert.match(intakeWorker, /export async function runIntakeRouter\(\s*config: IntakeRouterConfig,\s*workspaceId: string,\s*leadId: string,\s*taskCreatorId: string,\s*eventKey: string,\s*\)/)
const officeWorker = readFileSync('workers/office-copilot.ts', 'utf8')
assert.match(officeWorker, /export async function runOfficeCopilot\(\s*config: OfficeCopilotConfig,\s*workspaceId: string,\s*inspectionId: string,\s*reviewTaskCreatorId: string,\s*eventKey: string,\s*\)/)

// Registry points at the deployed entry points.
const registry = readFileSync('workers/agent-registry.ts', 'utf8')
assert.ok(registry.includes("entryPoint: '/api/cron/intake-router'"))
assert.ok(registry.includes("heartbeatSource: 'app/api/cron/intake-router/route.ts'"))
assert.ok(registry.includes("entryPoint: '/api/cron/office-copilot'"))
assert.ok(registry.includes("heartbeatSource: 'app/api/cron/office-copilot/route.ts'"))

// Scheduled through the consolidated daily dispatcher (Vercel Hobby allows two crons).
const daily = readFileSync('app/api/cron/daily/route.ts', 'utf8')
assert.ok(daily.includes("invoke('intake_router', runIntakeRouter, request)"))
assert.ok(daily.includes("invoke('office_copilot', runOfficeCopilot, request)"))
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
for (const path of ['/api/cron/intake-router', '/api/cron/office-copilot']) {
  assert.ok(!(vercel.crons ?? []).some((cron) => cron.path === path), `${path} must run through the daily dispatcher`)
}

console.log('agent-cron-routes-contract-test: PASS')
