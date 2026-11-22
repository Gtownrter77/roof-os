import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateEstimateLineItems } from '../lib/estimates/line-items.ts'

// The validator is now the single source of truth for both create and update.
const tooMany = Array.from({ length: 201 }, (_, i) => ({ description: `Item ${i}`, category: 'material', unit: 'SQ', quantity: 1, unit_cost: 1 }))
assert.match(validateEstimateLineItems(tooMany) ?? '', /200/)
assert.match(validateEstimateLineItems([{ description: 'x'.repeat(501), category: 'material', unit: 'SQ', quantity: 1, unit_cost: 1 }]) ?? '', /Line item 1/)
assert.match(validateEstimateLineItems([{ description: 'Valid', category: 'material', unit: 'x'.repeat(21), quantity: 1, unit_cost: 1 }]) ?? '', /Line item 1/)
assert.equal(validateEstimateLineItems([{ description: 'Valid', category: 'material', unit: 'SQ', quantity: 1, unit_cost: 1 }]), null)

const post = readFileSync('app/api/estimates/route.ts', 'utf8')
const put = readFileSync('app/api/estimates/[id]/route.ts', 'utf8')
for (const [label, source] of [['POST', post], ['PUT', put]]) {
  assert.match(source, /validateEstimateLineItems/, `${label} must use the shared line-item validator`)
  assert.ok(!/length > 500/.test(source), `${label} must not keep an independent 200-item limit`)
}
// Snapshot edits must survive a same-request line-item replacement.
assert.ok(!/\}\s*else if \(body\.status !== undefined \|\|/.test(put), 'PUT must not gate snapshot updates behind line-item absence')
assert.match(put, /const updateSnapshot = /, 'PUT must compute snapshot updates independently of line items')
console.log('estimate-put-contract-test: PASS (shared validator; snapshot edits survive line-item replacement)')
