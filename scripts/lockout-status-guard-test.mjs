import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canTagEstimateLocks } from '../lib/estimates/status.ts'

// A lockout tag must never downgrade an estimate that is already approved,
// rejected or superseded (e.g. one approved directly through PUT).
assert.equal(canTagEstimateLocks('draft'), true)
assert.equal(canTagEstimateLocks('pending_approval'), true)
assert.equal(canTagEstimateLocks('approved'), false)
assert.equal(canTagEstimateLocks('rejected'), false)
assert.equal(canTagEstimateLocks('superseded'), false)
assert.equal(canTagEstimateLocks(undefined), false)
assert.equal(canTagEstimateLocks(null), false)

const route = readFileSync('app/api/estimates/[id]/lockout/route.ts', 'utf8')
assert.match(route, /canTagEstimateLocks\(estimate\.status\)/, 'lockout route must reject terminal estimate states before writing tags')
assert.match(route, /status: 409/, 'lockout route must return a conflict for terminal states')
console.log('lockout-status-guard-test: PASS (terminal states rejected before any tag write)')
