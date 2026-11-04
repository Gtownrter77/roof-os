#!/usr/bin/env node
// READ-ONLY live-gate verification for the agent cron routes.
//
// Usage (never against production):
//   ROOF_AGENT_GATES_NONPROD=true \
//   ROOF_AGENT_GATES_CONFIRM=I_UNDERSTAND_DRY_RUN_ONLY \
//   ROOF_AGENT_GATES_BASE_URL=https://<staging-or-local-host> \
//   CRON_SECRET=<that deployment's cron secret> \
//   node scripts/verify-agent-live-gates.mjs
//
// It only sends GET requests:
//   1. /api/cron/agent-alerts?dryRun=1   (gate: proves the deployment supports dry-run;
//                                          older deployments 404 here and the script stops)
//   2. /api/cron/intake-router?dryRun=1
//   3. /api/cron/office-copilot?dryRun=1
//   4. /api/cron/heartbeat               (read-only readiness report)
// Each dry-run response must echo `dryRun: true`; otherwise the script stops immediately.
// It checks that every planned action stays inside its own workspace and record, and that
// the heartbeat report keeps one result per workspace per agent across at least
// ROOF_AGENT_GATES_MIN_WORKSPACES (default 2) workspaces. Nothing is written.
import { pathToFileURL } from 'node:url'

export const CONFIRM_PHRASE = 'I_UNDERSTAND_DRY_RUN_ONLY'
const DEFAULT_PRODUCTION_HOSTS = ['roof-os-lemon.vercel.app']

export class GateError extends Error {}

export function assertNonProductionTarget(env) {
  if (env.ROOF_AGENT_GATES_NONPROD !== 'true') throw new GateError('Set ROOF_AGENT_GATES_NONPROD=true to confirm the target is not production.')
  if (env.ROOF_AGENT_GATES_CONFIRM !== CONFIRM_PHRASE) throw new GateError(`Set ROOF_AGENT_GATES_CONFIRM=${CONFIRM_PHRASE}.`)
  const raw = env.ROOF_AGENT_GATES_BASE_URL?.trim()
  if (!raw) throw new GateError('ROOF_AGENT_GATES_BASE_URL is required.')
  let url
  try { url = new URL(raw) } catch { throw new GateError('ROOF_AGENT_GATES_BASE_URL must be an absolute URL.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new GateError('ROOF_AGENT_GATES_BASE_URL must be http(s).')
  const productionHosts = [
    ...DEFAULT_PRODUCTION_HOSTS,
    ...(env.ROOF_PRODUCTION_HOSTS ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean),
  ]
  if (productionHosts.includes(url.hostname.toLowerCase())) throw new GateError(`Refusing to run against production host ${url.hostname}.`)
  const secret = env.CRON_SECRET?.trim()
  if (!secret) throw new GateError('CRON_SECRET is required (the target deployment\'s secret).')
  const minWorkspaces = Number.parseInt(env.ROOF_AGENT_GATES_MIN_WORKSPACES ?? '2', 10)
  return { baseUrl: url.origin, secret, minWorkspaces: Number.isFinite(minWorkspaces) && minWorkspaces > 0 ? minWorkspaces : 2 }
}

async function getJson(fetchImpl, baseUrl, path, secret) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}`, accept: 'application/json' },
    redirect: 'manual',
  })
  let body = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body }
}

function checkDryRun(name, result) {
  if (result.status === 404) throw new GateError(`${name}: 404. The deployment does not have dry-run support yet; stopping before any other route is called.`)
  if (result.status === 401) throw new GateError(`${name}: 401. CRON_SECRET does not match the deployment.`)
  if (result.status === 503) throw new GateError(`${name}: 503 ${result.body?.error ?? ''}`.trim())
  if (!result.body || result.body.dryRun !== true) throw new GateError(`${name}: response did not confirm dryRun=true (status ${result.status}); stopping.`)
  if (result.status !== 200) throw new GateError(`${name}: dry-run returned ${result.status}: ${JSON.stringify(result.body?.failures ?? result.body)}`)
}

/** Every planned action must reference only its own record and workspace. */
export function checkPlannedIsolation(name, planned, recordField) {
  const problems = []
  for (const item of planned ?? []) {
    const recordId = item[recordField]
    if (!item.workspaceId || !recordId) { problems.push(`${name}: planned item missing workspaceId/${recordField}`); continue }
    if (item.batchKey && !String(item.batchKey).includes(recordId)) problems.push(`${name}: batch key ${item.batchKey} does not belong to ${recordId}`)
    if (item.eventKey && !String(item.eventKey).includes(recordId)) problems.push(`${name}: event key ${item.eventKey} does not belong to ${recordId}`)
    for (const action of item.actions ?? []) {
      const payload = action.payload ?? {}
      if (recordField === 'leadId') {
        if (action.subjectId !== recordId) problems.push(`${name}: action ${action.idempotencyKey} targets ${action.subjectId}, not lead ${recordId}`)
        if (payload.leadId && payload.leadId !== recordId) problems.push(`${name}: action ${action.idempotencyKey} payload lead ${payload.leadId} != ${recordId}`)
      }
      if (recordField === 'inspectionId' && payload.inspectionId && payload.inspectionId !== recordId) {
        problems.push(`${name}: action ${action.idempotencyKey} payload inspection ${payload.inspectionId} != ${recordId}`)
      }
      if (payload.workspaceId && payload.workspaceId !== item.workspaceId) problems.push(`${name}: action ${action.idempotencyKey} crosses into workspace ${payload.workspaceId}`)
    }
  }
  const keys = (planned ?? []).map((item) => `${item.workspaceId}:${item[recordField]}`)
  if (new Set(keys).size !== keys.length) problems.push(`${name}: the same record was planned twice`)
  return problems
}

/** One readiness result per workspace per agent, and enough workspaces to prove isolation. */
export function checkHeartbeatIsolation(report, minWorkspaces) {
  const problems = []
  if (!report || !Array.isArray(report.agents)) return ['heartbeat: report has no agents array']
  if ((report.workspaceCount ?? 0) < minWorkspaces) problems.push(`heartbeat: ${report.workspaceCount ?? 0} workspace(s); need at least ${minWorkspaces} to verify isolation`)
  for (const agent of report.agents) {
    const ids = (agent.workspaces ?? []).map((workspace) => workspace.workspaceId)
    if (new Set(ids).size !== ids.length) problems.push(`heartbeat: ${agent.agentKey} reports a workspace more than once`)
    if (ids.length !== report.workspaceCount) problems.push(`heartbeat: ${agent.agentKey} covers ${ids.length}/${report.workspaceCount} workspaces`)
  }
  return problems
}

export async function verifyAgentLiveGates({ baseUrl, secret, minWorkspaces = 2, fetchImpl = fetch, log = () => {} }) {
  const summary = { baseUrl, checks: [], problems: [] }

  const alerts = await getJson(fetchImpl, baseUrl, '/api/cron/agent-alerts?dryRun=1', secret)
  checkDryRun('agent-alerts', alerts)
  summary.checks.push({ route: 'agent-alerts', status: alerts.status, alerts: (alerts.body.alerts ?? []).length })
  log(`agent-alerts dry-run: ${(alerts.body.alerts ?? []).length} alert(s) would be raised`)

  const plannedWorkspaces = new Set()
  for (const [route, field] of [['intake-router', 'leadId'], ['office-copilot', 'inspectionId']]) {
    const result = await getJson(fetchImpl, baseUrl, `/api/cron/${route}?dryRun=1`, secret)
    checkDryRun(route, result)
    const planned = result.body.planned ?? []
    for (const item of planned) plannedWorkspaces.add(item.workspaceId)
    summary.problems.push(...checkPlannedIsolation(route, planned, field))
    summary.checks.push({ route, status: result.status, planned: planned.length, skipped: result.body.skipped ?? 0, alreadyProcessed: result.body.alreadyProcessed ?? 0 })
    log(`${route} dry-run: ${planned.length} planned, ${result.body.skipped ?? 0} skipped (disabled), ${result.body.alreadyProcessed ?? 0} already processed`)
  }

  const heartbeat = await getJson(fetchImpl, baseUrl, '/api/cron/heartbeat', secret)
  if (heartbeat.status === 401) throw new GateError('heartbeat: 401. CRON_SECRET does not match the deployment.')
  if (![200, 503].includes(heartbeat.status) || heartbeat.body?.boundary !== 'heartbeat-only') {
    summary.problems.push(`heartbeat: unexpected response ${heartbeat.status}`)
  } else {
    summary.problems.push(...checkHeartbeatIsolation(heartbeat.body, minWorkspaces))
    const known = new Set((heartbeat.body.agents?.[0]?.workspaces ?? []).map((workspace) => workspace.workspaceId))
    for (const workspaceId of plannedWorkspaces) {
      if (known.size && !known.has(workspaceId)) log(`note: planned workspace ${workspaceId} is outside the first ${known.size} workspaces in the heartbeat report`)
    }
    summary.checks.push({ route: 'heartbeat', status: heartbeat.status, workspaceCount: heartbeat.body.workspaceCount, notReady: heartbeat.body.notReady })
    log(`heartbeat: ${heartbeat.body.workspaceCount} workspace(s); not ready: ${(heartbeat.body.notReady ?? []).join(', ') || 'none'}`)
  }

  summary.ok = summary.problems.length === 0
  return summary
}

async function main() {
  try {
    const target = assertNonProductionTarget(process.env)
    const summary = await verifyAgentLiveGates({ ...target, log: (line) => console.log(line) })
    console.log(JSON.stringify(summary, null, 2))
    if (!summary.ok) {
      console.error(`verify-agent-live-gates: FAIL (${summary.problems.length} problem(s))`)
      process.exit(1)
    }
    console.log('verify-agent-live-gates: PASS (dry-run only; no data was written)')
  } catch (error) {
    console.error(`verify-agent-live-gates: STOPPED: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
