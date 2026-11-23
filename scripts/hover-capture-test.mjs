import assert from 'node:assert/strict'
import { validateCapture } from '../lib/hover/capture.ts'
import { CAPTURE_SLOTS } from '../lib/hover/types.ts'

const baseImage = (id, slot, overrides = {}) => ({
  id, jobId: 'job-1', workspaceId: 'ws-1', storagePath: `photos/${id}.jpg`,
  sha256: 'a'.repeat(64), byteSize: 100000, slot, role: 'model',
  gpsInFile: true, exif: { latitude: 33.9, longitude: -84.6 },
  blurScore: 0.9, lightScore: 0.8, capturedAt: '2026-11-23T00:00:00.000Z',
  ...overrides,
})

const eight = CAPTURE_SLOTS.map((slot, i) => baseImage(`img-${i}`, slot.id))
const anchor = (overrides = {}) => ({
  id: 'anchor-1', jobId: 'job-1', kind: 'bar', observedValue: 10,
  unit: 'ft', sourceImageId: 'img-0', confidence: 0.9, ...overrides,
})

const good = validateCapture(eight, [anchor()])
assert.equal(good.complete, true)
assert.deepEqual(good.missingSlots, [])
assert.equal(good.quality, 'ok')
assert.equal(good.rejectedImages.length, 0)
assert.equal(good.anchorsAccepted.length, 1)

const missing = validateCapture(eight.filter((image) => image.slot !== 'left'), [anchor()])
assert.equal(missing.complete, false)
assert.deepEqual(missing.missingSlots, ['left'])

const duplicate = validateCapture([...eight.slice(0, 7), baseImage('dup', 'front')], [anchor()])
assert.equal(duplicate.complete, false)
assert.ok(duplicate.rejectedImages.some((item) => /duplicate/i.test(item.reason)))

const damageOnly = validateCapture([baseImage('damage-1', null, { role: 'damage' })], [anchor()])
assert.equal(damageOnly.complete, false)
assert.equal(damageOnly.rejectedImages.length, 0, 'damage photos must not be rejected as model slots')

const noGps = validateCapture(eight.map((image, i) => i === 0 ? { ...image, gpsInFile: false } : image), [anchor()])
assert.equal(noGps.complete, false)
assert.ok(noGps.rejectedImages.some((item) => /gps/i.test(item.reason)))

const blurred = validateCapture(eight.map((image, i) => i === 0 ? { ...image, blurScore: 0.2 } : image), [anchor()])
assert.equal(blurred.quality, 'recapture')

const dark = validateCapture(eight.map((image, i) => i === 0 ? { ...image, lightScore: 0.1 } : image), [anchor()])
assert.equal(dark.quality, 'recapture')

const badAnchor = validateCapture(eight, [anchor({ observedValue: 0 })])
assert.equal(badAnchor.anchorsAccepted.length, 0)
assert.ok(/reference|anchor/i.test(badAnchor.reason || ''), 'invalid reference anchor must be flagged')

const noAnchor = validateCapture(eight, [])
assert.equal(noAnchor.complete, true)
assert.ok(/reference|anchor/i.test(noAnchor.reason || ''), 'missing reference anchor must be flagged')

console.log('hover-capture-test: PASS')
