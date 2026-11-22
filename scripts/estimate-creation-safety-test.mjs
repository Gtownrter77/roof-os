import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { creationApprovalFields, rollbackFailure } from '../lib/estimates/creation-safety.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const USER = '55555555-5555-4555-8555-555555555555'
const NOW = '2026-11-22T12:00:00.000Z'

// An admin who creates an approved estimate must also record who approved it,
// when, and the completed self lock. Otherwise downstream gates reject the
// estimate even though its status says approved.
const approved = creationApprovalFields('approved', USER, NOW)
assert.equal(approved.approved_by, USER)
assert.equal(approved.approved_at, NOW)
assert.deepEqual(approved.approval_tags, [{ step: 'self', layer: 'admin', user_id: USER, tagged_at: NOW }])
const draft = creationApprovalFields('draft', USER, NOW)
assert.equal(draft.approved_by, null)
assert.equal(draft.approved_at, null)
assert.deepEqual(draft.approval_tags, [])
assert.equal(creationApprovalFields('approved', USER, 'bad-clock'), null, 'invalid clocks must fail closed')

// A failed compensating delete must never be silently swallowed: the caller
// needs the orphan estimate id for cleanup and an honest error.
const lineError = 'line item insert failed'
assert.deepEqual(rollbackFailure('est-1', null, lineError), { error: 'Could not create estimate line items.', detail: lineError })
const failedRollback = rollbackFailure('est-1', { message: 'delete blocked' }, lineError)
assert.match(failedRollback.error, /needs operator cleanup/, 'rollback failure must be operator-visible')
assert.match(failedRollback.detail, /est-1/, 'orphan id must be reported')

const route = read('../app/api/estimates/route.ts')
assert.match(route, /creationApprovalFields\(status, user\.id, nowIso\)/, 'POST must build approval fields from a single clock')
assert.match(route, /\.\.\.approvalFields/, 'approval fields must be included in the insert payload')
assert.match(route, /rollbackFailure\(/, 'POST must use the honest rollback helper')
assert.match(route, /const \{ error: rollbackError \} = await supabase/, 'the compensating delete error must be captured')
assert.match(route, /if \(status === 'approved'\)/, 'admin approval authority is still required')

console.log('estimate-creation-safety-test: PASS (approved creation carries approval metadata and lock; failed rollback reports the orphan)')
