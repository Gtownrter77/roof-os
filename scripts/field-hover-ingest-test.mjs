import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  mapInspectionPhoto,
  anchorIdempotencyKey,
  newJobForDraft,
} = await import(new URL('../lib/hover/field-ingest.ts', import.meta.url).href)

const photo = {
  id: 'photo-1',
  inspection_id: 'draft-1',
  workspace_id: 'ws-1',
  bucket_id: 'inspection-photos',
  object_path: 'ws-1/user-1/draft-1/front.jpg',
  album: 'model',
  hover_slot: 'front_right',
  blur_score: 0.83,
  light_score: null,
  captured_at: '2026-11-23T10:01:00.000Z',
  // Client-supplied GPS claims must never be trusted.
  gps_verified: true,
  gps_in_file: true,
  client_gps: { latitude: 40.1, longitude: -75.2 },
}

const mapped = mapInspectionPhoto(photo, false)
assert.equal(mapped.id, 'photo-1')
assert.equal(mapped.slot, 'front_right', 'the uploaded slot must be preserved')
assert.equal(mapped.role, 'model')
assert.equal(mapped.blurScore, 0.83, 'blur score must be preserved')
assert.equal(mapped.lightScore, null, 'an unscored photo must stay null')
assert.equal(mapped.gpsInFile, false, 'a rejected client GPS claim must never become GPS-in-file')
assert.equal(mapped.storagePath, photo.object_path)

const verified = mapInspectionPhoto(photo, true)
assert.equal(verified.gpsInFile, true, 'only server byte verification can set GPS-in-file')
assert.equal(verified.sha256, '')
assert.equal(verified.byteSize, 0)
assert.equal(verified.exif, null)

const evidence = mapInspectionPhoto({ ...photo, hover_slot: null, album: 'damage' }, false)
assert.equal(evidence.role, 'evidence', 'an unslotted photo is supporting evidence, never a model slot')
assert.equal(evidence.slot, null)

const anchor = { kind: 'door', observedValue: 80, unit: 'ft' }
const key = anchorIdempotencyKey('ws-1', 'draft-1', anchor)
assert.match(key, /^[a-f0-9]{64}$/, 'anchor idempotency key must be a stable hex digest')
assert.equal(anchorIdempotencyKey('ws-1', 'draft-1', anchor), key, 'retries must reuse the same key')
assert.notEqual(anchorIdempotencyKey('ws-1', 'draft-1', { ...anchor, observedValue: 81 }), key, 'a changed value changes the key')
assert.notEqual(anchorIdempotencyKey('ws-1', 'draft-1', { ...anchor, unit: 'm' }), key, 'a changed unit changes the key')
assert.notEqual(anchorIdempotencyKey('ws-2', 'draft-1', anchor), key, 'workspace scope changes the key')

const job = newJobForDraft({ id: 'draft-1', workspace_id: 'ws-1', created_by: 'user-1' })
assert.equal(job.workspace_id, 'ws-1')
assert.equal(job.capture_mode, 'exterior')
assert.equal(job.deliverable, 'full_exterior')
assert.equal(job.sla_tier, 'visual-twin')

const route = readFileSync(new URL('../app/api/hover/ingest/route.ts', import.meta.url), 'utf8')
assert.ok(route.includes('readEmbeddedGps(bytes)'), 'draft ingest must byte-verify embedded GPS')
assert.ok(route.includes('mapInspectionPhoto('), 'draft ingest must use the metadata mapper')
assert.ok(route.includes('buildInputManifest('), 'draft ingest must call the unchanged manifest builder')
assert.ok(
  route.indexOf('readEmbeddedGps(bytes)') < route.indexOf(".from('scan_images').upsert"),
  'server verification must precede every scan_images write',
)
assert.ok(route.includes('anchorIdempotencyKey('), 'draft ingest must upsert anchors by idempotency key')

console.log('PASS field ingest mapping and server-verified GPS gate')
