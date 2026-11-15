import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BAILEY_AGENT_CATALOG, defaultBaileyAgentSetup } from '../lib/bailey-agent-onboarding.ts'
import { AGENT_KEYS } from '../workers/agent-registry.ts'
import {
  BAILEY_LEGACY_WORKER_RELATIONS,
  EXISTING_LEGACY_WORKER_KEYS,
  baileyDispatchIsAuthorized,
  describeBaileyAgentReadiness,
} from '../lib/bailey-agent-readiness.ts'

assert.equal(BAILEY_AGENT_CATALOG.length, 15)
assert.deepEqual(EXISTING_LEGACY_WORKER_KEYS, AGENT_KEYS)
assert.deepEqual(Object.keys(BAILEY_LEGACY_WORKER_RELATIONS).sort(), BAILEY_AGENT_CATALOG.map((x) => x.key).sort())
for (const agent of BAILEY_AGENT_CATALOG) {
  assert.ok(BAILEY_LEGACY_WORKER_RELATIONS[agent.key].every((key) => AGENT_KEYS.includes(key)))
}

const setup = defaultBaileyAgentSetup()
const now = '2026-11-15T12:00:00.000Z'
const evidence = describeBaileyAgentReadiness(setup, 'draft', {
  scheduler: { status: 'healthy', last_seen_at: '2026-11-15T11:59:00.000Z' },
  intake_router: { status: 'healthy', last_seen_at: '2026-11-15T10:00:00.000Z' },
  inspection_quality: { status: 'stopped', last_seen_at: now },
}, now)

assert.equal(evidence.length, 15)
assert.equal(new Set(evidence.map((x) => x.key)).size, 15)
for (const agent of evidence) {
  assert.equal(agent.implementedAsBaileyAgent, false)
  assert.equal(agent.operational, false)
  assert.equal(agent.executionAuthorized, false)
  assert.equal(agent.classification, 'not_implemented')
  assert.equal(agent.preference, 'off')
  assert.equal(baileyDispatchIsAuthorized(agent.key, setup), false)
  assert.ok(agent.relatedWorkers.every((worker) => worker.evidenceType === 'legacy_worker_heartbeat'))
}
const scheduler = evidence.find((x) => x.key === 'scheduling')
assert.equal(scheduler.relatedWorkers[0].workerKey, 'scheduler')
assert.equal(scheduler.relatedWorkers[0].ready, true)
const reception = evidence.find((x) => x.key === 'business_receptionist')
assert.equal(reception.relatedWorkers[0].ready, false)
assert.equal(reception.relatedWorkers[0].reason, 'heartbeat_stale')
const security = evidence.find((x) => x.key === 'quality_security')
assert.equal(security.relatedWorkers[0].reason, 'worker_stopped')
const chief = evidence.find((x) => x.key === 'chief_of_staff')
assert.equal(chief.relatedWorkers[0].reason, 'heartbeat_missing')
const calling = evidence.find((x) => x.key === 'personal_calling')
assert.deepEqual(calling.relatedWorkers, [])

const wanted = { ...setup, personal_calling: 'approval_required', finance: 'review_only' }
const reviewed = describeBaileyAgentReadiness(wanted, 'reviewed', { scheduler: { status: 'healthy', last_seen_at: now } }, now)
assert.equal(reviewed.find((x) => x.key === 'personal_calling').operational, false)
assert.equal(reviewed.find((x) => x.key === 'finance').executionAuthorized, false)
assert.equal(baileyDispatchIsAuthorized('personal_calling', wanted), false)
assert.equal(baileyDispatchIsAuthorized('finance', wanted), false)

const route = readFileSync(new URL('../app/api/onboarding/agents/readiness/route.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/onboarding/agents/page.tsx', import.meta.url), 'utf8')
assert.match(route, /supabase\.auth\.getUser\(\)/)
assert.match(route, /current_workspace_id/)
assert.match(route, /is_workspace_admin/)
assert.match(route, /if \(isAdmin !== true\)/)
assert.match(route, /\.eq\('workspace_id', workspaceId\)/)
assert.match(route, /from\('agent_worker_heartbeats'\)/)
assert.match(route, /validateBaileyAgentSetup\(stored\.setup\)/)
assert.match(route, /operationalAgentCount: 0/)
assert.match(route, /executionAuthorized: false/)
assert.match(route, /Cache-Control': 'no-store'/)
assert.doesNotMatch(route, /createAdminClient|service_role|executeApprovedBatch|\.upsert\(|\.insert\(|\.update\(|\.delete\(/)
assert.match(page, /fetch\('\/api\/onboarding\/agents\/readiness', \{ cache: 'no-store' \}\)/)
assert.match(page, /Implementation: Not yet verified as a BAILEY agent/)
assert.match(page, /payload\.executionAuthorized !== false/)
assert.match(page, /payload\.operationalAgentCount !== 0/)
console.log('BAILEY 15-agent read-only readiness bridge tests PASS')
