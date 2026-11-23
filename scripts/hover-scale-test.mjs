import assert from 'node:assert/strict'
import { solveScale, canPublish } from '../lib/hover/scale.ts'

const anchor = (id, kind, observedValue, overrides = {}) => ({
  id, jobId: 'job-1', kind, observedValue, unit: 'ft',
  sourceImageId: null, confidence: 0.9, ...overrides,
})
const context = { manifestHash: 'a'.repeat(64), engineVersions: { colmap: '3.9' }, reprojectionErrorPx: 0.4 }

const single = solveScale([anchor('a1', 'door', 10)], { a1: 120.2 }, context)
assert.ok(Math.abs(single.scale - 10 / 120.2) < 1e-9)
assert.equal(single.metricStatus, 'metric')
assert.equal(canPublish(single), true)
assert.deepEqual(single.anchorsUsed, ['a1'])
assert.ok(single.residualsIn[0] <= 1)
assert.equal(single.gpsDownweighted, false, 'no GPS anchor means no down-weighting event')
assert.equal(single.reprojectionErrorPx, 0.4)

const disagree = solveScale([
  anchor('a1', 'bar', 10), anchor('a2', 'door', 10),
], { a1: 120, a2: 121 }, context)
assert.equal(disagree.anchorsUsed.length, 2)
assert.equal(disagree.residualsIn.length, 2)
assert.ok(disagree.residualsIn.some((value) => value > 0))
assert.ok(disagree.disagreementIn > 0)

const withGps = solveScale([
  anchor('a1', 'bar', 10), anchor('a2', 'gps', 10, { confidence: 1 }),
], { a1: 125, a2: 120 }, context)
const barScale = 10 / 125
const gpsScale = 10 / 120
assert.ok(Math.abs(withGps.scale - barScale) < Math.abs(withGps.scale - gpsScale), 'GPS prior must not dominate a placed scale bar')
assert.equal(withGps.gpsDownweighted, true)

const none = solveScale([], {}, context)
assert.equal(none.metricStatus, 'relative-only')
assert.equal(canPublish(none), false)
assert.equal(none.scale, null)

const bad = solveScale([
  anchor('a1', 'bar', 10), anchor('a2', 'garage', 10),
], { a1: 120, a2: 100 }, context)
assert.equal(bad.metricStatus, 'failed')
assert.equal(canPublish(bad), false)
assert.ok(bad.residualsIn.every((value) => value > 1))

console.log('hover-scale-test: PASS')
