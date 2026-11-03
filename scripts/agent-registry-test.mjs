import assert from 'node:assert/strict'
import { AGENT_KEYS, getAgentRegistration, evaluateAgentReadiness } from '../workers/agent-registry.ts'

assert.deepEqual(AGENT_KEYS, ['intake_router', 'scheduler', 'inspection_quality', 'office_copilot'])

const intake = getAgentRegistration('intake_router')
assert.equal(intake.agentKey, 'intake_router')
assert.equal(intake.implemented, true)
assert.match(intake.entryPoint, /intake-router/)

const quality = getAgentRegistration('inspection_quality')
assert.equal(quality.implemented, true)
assert.match(quality.entryPoint, /inspection-quality/)

const office = getAgentRegistration('office_copilot')
assert.equal(office.implemented, true)
assert.match(office.entryPoint, /office-copilot/)

const now = '2026-11-03T20:00:00.000Z'
assert.deepEqual(
  evaluateAgentReadiness(quality, { status: 'healthy', last_seen_at: '2026-11-03T19:59:00.000Z' }, now, 5 * 60 * 1000),
  { ready: true, reason: 'healthy' },
)
assert.deepEqual(
  evaluateAgentReadiness(quality, { status: 'healthy', last_seen_at: '2026-11-03T19:00:00.000Z' }, now, 5 * 60 * 1000),
  { ready: false, reason: 'heartbeat_stale' },
)
assert.deepEqual(
  evaluateAgentReadiness(intake, { status: 'healthy', last_seen_at: '2026-11-03T19:59:00.000Z' }, now, 5 * 60 * 1000),
  { ready: true, reason: 'healthy' },
)
assert.deepEqual(
  evaluateAgentReadiness(quality, { status: 'stopped', last_seen_at: now }, now, 5 * 60 * 1000),
  { ready: false, reason: 'worker_stopped' },
)
console.log('agent-registry-test: PASS')
