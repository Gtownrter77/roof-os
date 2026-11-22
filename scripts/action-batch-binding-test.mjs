import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { needsApprovalTokenHash } from '../lib/action-batch-binding.ts'

// 72: only approval-required actions need a signed approval-token binding.
assert.equal(needsApprovalTokenHash([]), false, 'an empty action set needs no approval token')
assert.equal(needsApprovalTokenHash([{ requires_approval: false }, { requires_approval: false }]), false, 'low-risk batches need no approval token')
assert.equal(needsApprovalTokenHash([{ requires_approval: false }, { requires_approval: true }]), true, 'an approval-required action keeps the binding')

const executor = readFileSync(new URL('../workers/action-executor.ts', import.meta.url), 'utf8')
assert.ok(executor.includes("from '../lib/action-batch-binding'"), 'executor must import the binding helper')
assert.ok(
  /if \(batch\.status === 'approved' && needsApprovalTokenHash\(rows\)\)/.test(executor),
  'the approval-token check must be conditional on approval-required actions'
)

const batch = readFileSync(new URL('../workers/action-batch.ts', import.meta.url), 'utf8')
const rollback = batch.slice(batch.indexOf('if (actionError || !insertedActions) {'), batch.indexOf('return { batch'))
assert.ok(rollback.includes('rollbackError'), '76: the compensating delete result must be captured')
assert.ok(/orphan|could not be deleted/i.test(rollback), '76: a failed compensating delete must surface the orphan')
assert.ok(/batch\.id/.test(rollback), '76: the orphan batch id must be included for operator cleanup')

console.log('action-batch-binding-test: PASS (low-risk batches executable, orphan rollback surfaced)')
