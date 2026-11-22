import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nextLockEntry, nextLockStep } from '../lib/estimates/lockout.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const SEQUENCE = ['self', 'inspector', 'closer']

// A stale reader must never be able to append the same step twice.
assert.equal(nextLockStep([], SEQUENCE), 'self')
assert.equal(nextLockStep([{ step: 'self' }], SEQUENCE), 'inspector')
assert.equal(nextLockStep([{ step: 'self' }, { step: 'inspector' }], SEQUENCE), 'closer')
assert.equal(nextLockStep([{ step: 'self' }, { step: 'inspector' }, { step: 'closer' }], SEQUENCE), null, 'a full sequence has no next step')
assert.equal(nextLockStep([{ step: 'self' }, { step: 'bogus' }], SEQUENCE), null, 'corrupt tags cannot map to a privileged step')

const entry = nextLockEntry([{ step: 'self' }], SEQUENCE, 'inspector', 'user-1', '2026-11-22T00:00:00.000Z')
assert.deepEqual(entry, { step: 'inspector', layer: 'inspector', user_id: 'user-1', tagged_at: '2026-11-22T00:00:00.000Z' })
assert.equal(nextLockEntry([], SEQUENCE, 'owner', 'user-2', 'bad-date'), null, 'an invalid clock must fail closed')

const route = read('../app/api/estimates/[id]/lockout/route.ts')
assert.match(route, /nextLockEntry\(/, 'route must use the shared lock-step helper')
assert.match(route, /\.eq\('approval_tags', tags\)/, 'update must be conditioned on the tags that were read')
assert.match(route, /\.is\('approval_tags', null\)/, 'a null initial tag set needs an explicit null guard')
assert.match(route, /\.eq\('status', estimate\.status\)/, 'update must also be conditioned on the status that was read')
assert.match(route, /if \(!updated\?\.length\)/, 'a lost race must return a retry response instead of success')
assert.match(route, /status: 409/, 'retry response must be a conflict')

console.log('lockout-concurrency-test: PASS (next step derived from shared helper; optimistic lock on tags and status; lost race returns 409)')
