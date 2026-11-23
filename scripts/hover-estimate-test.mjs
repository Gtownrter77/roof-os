import assert from 'node:assert/strict'
import { buildEstimate, estimateFromDesign, estimateDiff } from '../lib/hover/estimate.ts'
import { assertPublishable } from '../lib/hover/qa.ts'

const evidence = [{ imageId: 'img-1', region: null, planeId: 'p1', modelVersion: 'recon-1' }]
const record = (id, type, value, unit, facetId) => ({
  id, setId: 'set-1', type, value, unit, confidence: 0.9,
  sourceRefs: evidence, status: 'accepted', ...(facetId ? { facetId } : {}),
})
const set = {
  id: 'set-1', jobId: 'job-1', workspaceId: 'ws-1', reconstructionId: 'recon-1',
  rulesetVersion: '1.0.0', status: 'locked',
  records: [
    record('r1', 'facet_area', 100, 'sqft', 'f1'),
    record('r2', 'pitch_adjusted_squares', 1.23, 'squares'),
    record('r3', 'gutter_lf', 40, 'lf'),
    record('r4', 'unknown', null, 'Unknown'),
  ],
  confidenceSummary: { min: 0.9, mean: 0.9, count: 4 },
  lockedBy: 'u-owner', lockedAt: '2026-11-23T01:00:00.000Z', createdAt: '2026-11-23T00:00:00.000Z',
}
const qaState = {
  set, events: [], locks: ['tech_lock', 'owner_final'], version: 1,
  ownerLockSequence: ['owner_final'],
}
assert.doesNotThrow(() => assertPublishable(qaState))

const design = (material) => ({
  jobId: 'job-1', setId: 'set-1', mode: '2d-photo', roofStyle: 'gable',
  facetGraphRef: 'recon-1:v1',
  selections: [{ facetId: 'f1', material, color: null, product: 'Product A' }],
  facets: [{ id: 'f1', material }],
  quantities: [{ facetId: 'f1', material, areaSqFt: 100, wasteFactor: material === 'shingle' ? 0.1 : 0.15,
    quantitySqFt: material === 'shingle' ? 110 : 115 }],
  hash: `design-${material}`,
})
const manifest = { jobId: 'job-1', workspaceId: 'ws-1', manifestHash: 'a'.repeat(64) }
const priceBook = {
  source: 'Owner-approved 2026 regional price book',
  at: '2026-01-15T00:00:00.000Z',
  prices: {
    facet_area: { price: 5, unit: 'sqft', source: 'Owner-approved 2026 regional price book' },
    pitch_adjusted_squares: { price: 300, unit: 'squares', source: 'Owner-approved 2026 regional price book' },
    gutter_lf: { price: 12, unit: 'lf', source: 'Owner-approved 2026 regional price book' },
  },
}
const base = { set, design: design('shingle'), manifest, priceBook, qaState, variant: 'base' }

const estimate = buildEstimate(base)
assert.equal(estimate.variant, 'base')
assert.equal(estimate.lines.length, 3, 'only priced measurement records become lines')
assert.ok(estimate.lines.every((line) => line.measuredFrom.startsWith('r')))
assert.ok(estimate.lines.every((line) => typeof line.price === 'number'))
assert.equal(estimate.lines.find((line) => line.code === 'facet_area').quantity, 110, 'design waste factor must drive quantity')
assert.equal(estimate.audit.rulesetVersion, '1.0.0')
assert.equal(estimate.audit.manifestHash, 'a'.repeat(64))
assert.equal(estimate.audit.designHash, 'design-shingle')
assert.match(estimate.audit.priceBookHash, /^[a-f0-9]{64}$/)
assert.equal(estimate.audit.priceBookAt, priceBook.at)
assert.equal(estimate.lines.find((line) => line.code === 'facet_area').priceSource, priceBook.source)

const changed = buildEstimate({ ...base, design: design('tile'), variant: 'alternative' })
const diff = estimateDiff(estimate, changed)
assert.ok(diff.some((entry) => entry.field === 'quantity' && entry.after === 115))
assert.equal(changed.variant, 'alternative')
assert.notEqual(changed.audit.designHash, estimate.audit.designHash)
assert.equal(buildEstimate(base).lines[0].quantity, estimate.lines[0].quantity)

const viaDesign = estimateFromDesign({ set, design: design('shingle'), manifest, priceBook, qaState, variant: 'base' })
assert.equal(viaDesign.audit.designHash, estimate.audit.designHash)
assert.deepEqual(viaDesign.lines, estimate.lines)

const missingPrice = buildEstimate({
  ...base,
  priceBook: { ...priceBook, prices: {} },
})
assert.equal(missingPrice.lines.length, 3)
assert.ok(missingPrice.lines.every((line) => line.price === null), 'unpriced lines fall back to null')

for (const malformed of [
  { price: -5, unit: 'sqft', source: 'book' },
  { price: '5', unit: 'sqft', source: 'book' },
  { price: Number.NaN, unit: 'sqft', source: 'book' },
  { price: 5, unit: '', source: 'book' },
  { price: 5, unit: 'sqft', source: '' },
]) {
  assert.throws(() => buildEstimate({
    ...base,
    priceBook: { ...priceBook, prices: { facet_area: malformed } },
  }), /price book|malformed|invalid/i)
}

assert.throws(() => buildEstimate({ ...base, qaState: undefined, set: { ...set, status: 'draft' } }), /lock|publish|unlocked/i)
assert.throws(() => buildEstimate({
  ...base,
  qaState: { ...qaState, locks: ['tech_lock'], set: { ...set, status: 'reviewed' } },
}), /lock|publish|owner/i)

console.log('hover-estimate-test: PASS')
