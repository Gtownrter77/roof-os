import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { teamSequencePayload, principalsInWorkspace } from '../lib/api-contract-safety.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 44: readJson returns { body }, not the body itself. The owner sequence save
// must extract .body or every valid save returns 400.
assert.deepEqual(
  teamSequencePayload({ body: { memberId: 'm-1', sequence: ['self', 'inspector'] } }),
  { memberId: 'm-1', sequence: ['self', 'inspector'] }
)
assert.equal(teamSequencePayload({ body: {} }), null, 'empty payloads fail closed')
assert.equal(teamSequencePayload({ memberId: 'm-1', sequence: ['self'] }), null, 'the wrapper itself is not a valid payload')
assert.equal(teamSequencePayload({ error: 'bad', status: 400 }), null)

// 45: every principal an action writes must be a member of the action's
// workspace at execution time, not just when the action was proposed.
const members = new Set(['owner-1', 'tech-2'])
assert.deepEqual(principalsInWorkspace(['owner-1', 'tech-2'], members), { ok: true, missing: [] })
assert.deepEqual(principalsInWorkspace(['owner-1', 'offboarded'], members), { ok: false, missing: ['offboarded'] })
assert.deepEqual(principalsInWorkspace([''], members), { ok: false, missing: [''] }, 'empty ids are rejected')

// Wiring
const teamRoute = read('../app/api/team/sequence/route.ts')
assert.match(teamRoute, /teamSequencePayload\(parsedBody\)/, 'PUT must unwrap readJson via the helper')
assert.ok(!/parsedBody as \{ memberId/.test(teamRoute), 'the miscast must be gone')

const executor = read('../workers/action-executor.ts')
assert.match(executor, /principalsInWorkspace\(/, 'executor must validate principals before writes')
assert.match(executor, /workspace_members/, 'validation must consult workspace membership')
assert.match(executor, /if \(!principals\.ok\)/, 'a non-member principal must block the write')

console.log('api-contract-safety-test: PASS (team sequence unwrap; action principals checked against workspace membership)')
