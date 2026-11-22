import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateEstimateNumber } from '../lib/estimates/estimate-types.ts'

const workspaceId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const createdAt = '2026-11-22T10:00:00.000Z'
const firstId = '11111111-2222-3333-4444-555555555555'
const secondId = '99999999-8888-7777-6666-555555555555'

const first = generateEstimateNumber(workspaceId, createdAt, firstId)
const second = generateEstimateNumber(workspaceId, createdAt, secondId)

assert.notEqual(first, second, 'two estimates in the same workspace/day must have distinct numbers')
assert.match(first, /^EST-20261122-AAAAAAAA-[0-9A-F]{8}$/, `unexpected estimate number: ${first}`)
assert.match(second, /^EST-20261122-AAAAAAAA-[0-9A-F]{8}$/, `unexpected estimate number: ${second}`)
assert.equal(
  generateEstimateNumber(workspaceId, createdAt, firstId),
  first,
  'estimate number must be deterministic for a given estimate',
)

// The API must use the shared generator at every call site so GET and POST
// cannot disagree, and must pass the per-estimate id.
const route = readFileSync('app/api/estimates/route.ts', 'utf8')
assert.match(route, /import \{[^}]*generateEstimateNumber[^}]*\} from '[^']*estimate-types'/, 'route must use the shared generator')
assert.equal((route.match(/generateEstimateNumber\(/g) ?? []).length, 2, 'route must call the shared generator at GET and POST')
assert.ok(!/return `EST-\$\{yyyy\}/.test(route), 'route must not keep its own colliding generator')
console.log('estimate-number-uniqueness-test: PASS (per-estimate suffix included at every call site)')
