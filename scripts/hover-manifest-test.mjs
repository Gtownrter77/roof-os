import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { buildInputManifest, verifyManifest, canonicalManifest } from '../lib/hover/manifest.ts'
import { assertWorkspaceMatch, hashBytes } from '../lib/hover/util.ts'
import { CAPTURE_SLOTS } from '../lib/hover/types.ts'

const job = {
  id: 'job-1', workspaceId: 'ws-1', propertyId: 'prop-1', status: 'capturing',
  captureMode: 'exterior', deliverable: 'roof_only', providerPath: 'oss',
  slaTier: 'estimated', ownerLockSequence: ['owner_final'], createdBy: 'user-1',
  createdAt: '2026-11-23T00:00:00.000Z',
}
const images = CAPTURE_SLOTS.map((slot, i) => ({
  id: `img-${i}`, jobId: 'job-1', workspaceId: 'ws-1', storagePath: `photos/${i}.jpg`,
  sha256: `${i}`.repeat(64), byteSize: 100000 + i, slot: slot.id, role: 'model',
  gpsInFile: true, exif: { latitude: 33.9, longitude: -84.6 },
  blurScore: 0.9, lightScore: 0.8, capturedAt: '2026-11-23T00:00:00.000Z',
}))
const anchors = [{
  id: 'anchor-1', jobId: 'job-1', kind: 'bar', observedValue: 10,
  unit: 'ft', sourceImageId: 'img-0', confidence: 0.9,
}]

const manifest = buildInputManifest(job, images, anchors)
assert.equal(manifest.jobId, 'job-1')
assert.equal(manifest.workspaceId, 'ws-1')
assert.equal(manifest.images.length, 8)
assert.equal(manifest.anchors.length, 1)
assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/)
assert.equal(canonicalManifest(manifest).includes('"manifestHash"'), false, 'hash must not be part of hashed bytes')

const reordered = buildInputManifest(job, [...images].reverse(), [...anchors].reverse())
assert.equal(reordered.manifestHash, manifest.manifestHash, 'reordering inputs must not change the hash')

const changed = buildInputManifest(job, images.map((image, i) => i === 0
  ? { ...image, sha256: hashBytes(new TextEncoder().encode('different')) } : image), anchors)
assert.notEqual(changed.manifestHash, manifest.manifestHash)

assert.equal(verifyManifest(manifest), true)
assert.equal(verifyManifest({ ...manifest, manifestHash: '0'.repeat(64) }), false)
const tampered = { ...manifest, images: manifest.images.map((image, i) => i === 0 ? { ...image, byteSize: 1 } : image) }
assert.equal(verifyManifest(tampered), false)

assert.throws(
  () => buildInputManifest(job, images.slice(0, 7), anchors),
  /slot|complete|capture/i,
)
assert.doesNotThrow(() => buildInputManifest(job, images, []))

assertWorkspaceMatch('ws-1', 'ws-1')
assert.throws(() => assertWorkspaceMatch('ws-1', 'ws-2'), /workspace/i)
assert.equal(existsSync('app/api/hover/ingest/route.ts'), true)
const route = readFileSync('app/api/hover/ingest/route.ts', 'utf8')
assert.match(route, /assertWorkspaceMatch/)
assert.match(route, /buildInputManifest/)
assert.match(route, /manifestHash|sha256|hashBytes/i)

console.log('hover-manifest-test: PASS')
