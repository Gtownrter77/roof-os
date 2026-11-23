import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { toScanImages, toScaleAnchors } = await import(new URL('../lib/hover/field-capture.ts', import.meta.url).href)

const rows = [
  {
    id: 11,
    draftId: 3,
    localUri: 'file:///front.jpg',
    album: 'model',
    hoverSlot: 'front',
    gpsVerified: 1,
    blurScore: 0.88,
    lightScore: null,
    capturedAt: '2026-11-23T10:01:00.000Z',
    supersededAt: null,
  },
  {
    id: 12,
    draftId: 3,
    localUri: 'file:///old-right.jpg',
    album: 'model',
    hoverSlot: 'right',
    gpsVerified: 1,
    blurScore: 0.2,
    lightScore: 0.9,
    capturedAt: '2026-11-23T10:02:00.000Z',
    supersededAt: '2026-11-23T10:05:00.000Z',
  },
  {
    id: 13,
    draftId: 3,
    localUri: 'file:///damage.jpg',
    album: 'damage',
    hoverSlot: null,
    gpsVerified: 0,
    blurScore: null,
    lightScore: null,
    capturedAt: '2026-11-23T10:03:00.000Z',
    supersededAt: null,
  },
]

const images = toScanImages(rows)
assert.equal(images.length, 1, 'superseded captures and non-model evidence must not be validated as model slots')
assert.equal(images[0].id, '11')
assert.equal(images[0].slot, 'front', 'the selected slot must become the contract slot')
assert.equal(images[0].role, 'model')
assert.equal(images[0].gpsInFile, true, 'a locally stamped photo becomes GPS-in-file for on-device guidance')
assert.equal(images[0].blurScore, 0.88)
assert.equal(images[0].lightScore, null, 'an unscored photo must stay null, never a pass')
assert.equal(images[0].exif, null)

const unstamped = toScanImages([{ ...rows[0], id: 14, gpsVerified: 0 }])
assert.equal(unstamped[0].gpsInFile, false, 'a stamp failure must not be promoted to GPS-in-file')

const anchors = toScaleAnchors([
  {
    id: 4,
    draftId: 3,
    clientId: 'anchor-door-1',
    kind: 'door',
    observedValue: 80,
    unit: 'ft',
    capturedAt: '2026-11-23T10:04:00.000Z',
  },
])
assert.equal(anchors.length, 1)
assert.equal(anchors[0].id, 'anchor-door-1')
assert.equal(anchors[0].kind, 'door')
assert.equal(anchors[0].observedValue, 80)
assert.equal(anchors[0].unit, 'ft')
assert.equal(anchors[0].confidence, 1, 'owner-entered references carry fixed confidence for reproducible hashes')
assert.equal(anchors[0].sourceImageId, null)

const appSource = readFileSync(new URL('../apps/field/App.tsx', import.meta.url), 'utf8')
assert.ok(
  appSource.includes('UPDATE inspection_photo_queue SET superseded_at = ?, superseded_reason = ? WHERE draft_id = ? AND hover_slot = ? AND superseded_at IS NULL'),
  'recapture must retire the old row for that slot without losing it',
)
assert.ok(appSource.includes('validateCapture(toScanImages('), 'the draft detail view must surface contract validation feedback')
assert.ok(appSource.includes("from '../../lib/hover/capture.ts'"), 'the field app must use the merged capture contract')
assert.ok(appSource.includes("from '../lib/hover/field-quality.ts'") || appSource.includes("from '../../lib/hover/field-quality.ts'"), 'the field app must score pixels with the shared helper')

console.log('PASS field hover capture mapping and UI contract')
