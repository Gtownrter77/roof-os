import assert from 'node:assert/strict'
import {
  applyTransition, stopClaim, canAgentRun, SCOPED_CAPABILITIES, JARVIS_AGENT_KEYS,
} from '../lib/jarvis/orchestrator.ts'
import { JARVIS_JOB_TYPES, JARVIS_LOGICAL_AGENT_COUNT } from '../lib/jarvis/types.ts'

const base = { status: 'new', disabled: false, planOnly: true, authorized: false }

const planned = applyTransition(base, 'plan_created')
assert.equal(planned.claim.status, 'planned')
assert.equal(planned.changed, true)

const blocked = applyTransition(planned.claim, 'contacted')
assert.equal(blocked.changed, false)
assert.equal(blocked.reason, 'plan_only')
assert.equal(blocked.claim.status, 'planned', 'a blocked transition must not mutate state')

const authorized = applyTransition({ ...planned.claim, authorized: true }, 'contacted')
assert.equal(authorized.changed, true)
assert.equal(authorized.claim.status, 'contacted')

const estimating = applyTransition({ ...authorized.claim, authorized: true }, 'estimate_extracted')
assert.equal(estimating.claim.status, 'estimating')
assert.equal(applyTransition({ ...estimating.claim, authorized: true }, 'quote_sent').claim.status, 'quoted')
assert.equal(applyTransition({ ...estimating.claim, authorized: true }, 'won').claim.status, 'won')
assert.equal(applyTransition({ ...estimating.claim, authorized: true }, 'lost').claim.status, 'lost')

const unknown = applyTransition(base, 'teleport')
assert.equal(unknown.changed, false)
assert.equal(unknown.reason, 'unknown_event')

const disabled = { ...base, disabled: true }
assert.equal(applyTransition(disabled, 'plan_created').changed, false)
assert.equal(applyTransition(disabled, 'cancel').claim.status, 'cancelled')

const stopped = stopClaim({ ...authorized.claim })
assert.equal(stopped.disabled, true)
assert.equal(stopped.status, 'cancelled')

// Capabilities are scoped inside the existing 15 agents. No 16th agent exists.
assert.equal(JARVIS_AGENT_KEYS.length, JARVIS_LOGICAL_AGENT_COUNT)
assert.ok(!JARVIS_AGENT_KEYS.some((key) => /adjuster/i.test(key)), 'the adjuster is not a separate agent')

for (const [agentKey, jobTypes] of Object.entries(SCOPED_CAPABILITIES)) {
  assert.ok(JARVIS_AGENT_KEYS.includes(agentKey), `${agentKey} must be an existing agent`)
  for (const type of jobTypes) {
    assert.ok(JARVIS_JOB_TYPES.includes(type), `${agentKey} has unknown job type ${type}`)
  }
}
const covered = new Set(Object.values(SCOPED_CAPABILITIES).flat())
assert.deepEqual(
  JARVIS_JOB_TYPES.filter((type) => !covered.has(type)),
  [],
  'every job type must be reachable through an existing agent',
)

assert.equal(canAgentRun('intake_router', 'run_claim_plan'), true)
assert.equal(canAgentRun('intake_router', 'send_message'), false)
assert.equal(canAgentRun('office_copilot', 'generate_document'), true)
assert.equal(canAgentRun('unknown_agent', 'run_claim_plan'), false)

console.log('jarvis-adjuster orchestrator contract passed')
