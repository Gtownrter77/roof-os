import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { isCertifiedPhotoContent } from '../lib/photo-provenance-integrity.mjs'
import { embedGpsIntoJpeg, readEmbeddedGps, hasEmbeddedGps } from '../lib/photo-provenance.mjs'

const jpeg = Uint8Array.from([0xff,0xd8,0xff,0xd9])
assert.equal(readEmbeddedGps(jpeg), null, 'A JPEG without EXIF is manual-only')
assert.equal(hasEmbeddedGps(jpeg), false, 'No coordinates cannot qualify')
assert.equal(readEmbeddedGps(Uint8Array.from([1,2,3])), null, 'Malformed file must fail closed')
assert.equal(readEmbeddedGps(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,73,69,78,68,174,66,96,130])), null)

const photo = embedGpsIntoJpeg(jpeg, {
  latitude: 33.875321, longitude: -84.705123,
  address: '123 Test Street, Testville, GA 30000',
  capturedAt: '2026-11-17T12:30:00.000Z',
})
const gps = readEmbeddedGps(photo)
assert.ok(gps)
assert.ok(Math.abs(gps.latitude - 33.875321) < 0.00001)
assert.ok(Math.abs(gps.longitude - -84.705123) < 0.00001)
assert.equal(gps.address, '123 Test Street, Testville, GA 30000')
assert.equal(gps.capturedAt, '2026-11-17T12:30:00.000Z')
assert.equal(hasEmbeddedGps(photo), true)
for (const [latitude, longitude] of [
  [33.9, -84.6],
  [-33.9, 84.6],
  [0, 0],
  [89.999999999, -179.999999999],
  [-89.999999999, 179.999999999],
  [90, 180],
]) {
  const stamped = embedGpsIntoJpeg(jpeg, {
    latitude, longitude, address: 'Measured property', capturedAt: '2026-11-18T05:00:00.000Z',
  })
  const embedded = readEmbeddedGps(stamped)
  assert.ok(embedded, 'EXIF GPS must survive normalized DMS rounding')
  assert.ok(Math.abs(embedded.latitude - latitude) <= 0.00001, 'GPS latitude precision lost')
  assert.ok(Math.abs(embedded.longitude - longitude) <= 0.00001, 'GPS longitude precision lost')
  assert.equal(embedded.address, 'Measured property')
}

// Certification is tied to exact original photo bytes and embedded coordinates,
// never to a database boolean alone.
const certification = {
  gps_verified: true,
  gps_sha256: createHash('sha256').update(photo).digest('hex'),
  gps_latitude: gps.latitude,
  gps_longitude: gps.longitude,
  gps_address: gps.address,
}
assert.equal(isCertifiedPhotoContent(certification, photo), true)
const modifiedBytes = new Uint8Array(photo.byteLength + 1)
modifiedBytes.set(photo)
modifiedBytes[photo.byteLength] = 42
assert.equal(isCertifiedPhotoContent(certification, modifiedBytes), false, 'Changing any image byte revokes automation eligibility')
assert.equal(isCertifiedPhotoContent({ ...certification, gps_verified: false }, photo), false)
assert.equal(isCertifiedPhotoContent({ ...certification, gps_sha256: '0'.repeat(64) }, photo), false)
assert.equal(isCertifiedPhotoContent({ ...certification, gps_address: 'Different property' }, photo), false)
assert.equal(isCertifiedPhotoContent({ ...certification, gps_latitude: 1 }, photo), false)

assert.ok(photo.byteLength > jpeg.byteLength)
const restamped = embedGpsIntoJpeg(photo, {
  latitude: -15.75, longitude: 72.5,
  address: '456 Another Road',
})
const restampedGps = readEmbeddedGps(restamped)
assert.ok(Math.abs(restampedGps.latitude + 15.75) < 0.00001)
assert.ok(Math.abs(restampedGps.longitude - 72.5) < 0.00001)
assert.equal(restampedGps.address, '456 Another Road')
assert.throws(() => embedGpsIntoJpeg(jpeg, { latitude: 91, longitude: 1, address: 'x' }))
assert.throws(() => embedGpsIntoJpeg(jpeg, { latitude: 1, longitude: Number.NaN, address: 'x' }))
assert.throws(() => embedGpsIntoJpeg(Uint8Array.from([2,3]), {latitude:1,longitude:1,address:'x'}))

const source = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const sql = source('supabase/migrations/105_photo_gps_automation_authority.sql')
assert.match(sql, /gps_verified boolean not null default false/)
assert.match(sql, /enable_auto_photo_measurements boolean not null default false/)
assert.match(sql, /role = 'owner'/)
assert.match(sql, /'service_role'/)
assert.match(sql, /photo_to_report_jobs/)
const io = source('lib/photo-provenance-io.ts')
assert.match(io, /new AbortController\(\)/)
assert.match(io, /setTimeout\(\(\) => controller\.abort\(\)/)
assert.match(io, /size > maxBytes/)
assert.match(io, /clearTimeout\(timer\)/)
const server = source('app/api/photo-provenance/verify/route.ts')
assert.match(server, /readEmbeddedGps\(bytes\)/)
assert.match(server, /photo\.uploaded_by !== user\.id/)
assert.match(server, /status: valid \? 'gps_verified' : 'manual_only'/)
const measures = [
  'app/api/measurements/aerial/route.ts',
  'app/api/measurements/aerial/ai-suggest/route.ts',
]
for (const file of measures) {
  const code = source(file)
  assert.match(code, /gps_verified !== true/)
  assert.match(code, /enable_auto_photo_measurements/)
  assert.match(code, /owner authorizes them/)
}
for (const file of ['app/api/photo-estimate/analyze/route.ts', 'app/api/siding/analyze/route.ts']) {
  assert.match(source(file), /gps_verified/)
  assert.match(source(file), /gps_address/)
}
const field = source('apps/field/App.tsx')
assert.match(field, /embedGpsIntoJpeg/)
assert.match(field, /readEmbeddedGps/)
assert.match(field, /asset\.gpsEmbedded/)
assert.match(field, /DELETE FROM inspection_ai_request_queue WHERE photo_queue_id/)
assert.match(field, /Paths\.document/, 'Offline image cannot rely on temporary camera cache')
assert.match(field, /await new File\(asset\.uri\)\.copy\(retained\)/, 'Original image must be retained before queuing')
assert.match(field, /if \(!verificationResponse\.ok\)/, 'Failed GPS verification must retry')
assert.match(field, /throw new Error\('GPS verification service unavailable/, 'Failed GPS service must not consume queue')
assert.match(field, /if \(!reportResponse\.ok \|\| report\?\.automationStarted !== true\)/, 'Failed report packet must retry')
const worker = source('workers/inspection-quality.ts')
assert.match(worker, /filter\(\(photo\) => photo\.gps_verified === true\)/)
assert.match(source('app/api/photo-to-report/route.ts'), /enable_auto_photo_measurements/)
assert.match(source('app/api/photo-to-report/route.ts'), /start_photo_to_report_review_packet/)
assert.match(source('app/api/photo-to-report/route.ts'), /isCertifiedPhotoContent\(photo, originalBytes\)/)
const atomic = source('supabase/migrations/106_photo_to_report_atomic_packet.sql')
assert.match(atomic, /on conflict \(workspace_id,photo_id\) do nothing/)
assert.match(atomic, /current_user <> 'service_role'/)
assert.match(atomic, /grant execute on function .*start_photo_to_report_review_packet/s)
for (const route of [
  'app/api/measurements/aerial/route.ts',
  'app/api/measurements/aerial/ai-suggest/route.ts',
  'app/api/photo-estimate/analyze/route.ts',
  'app/api/siding/analyze/route.ts',
]) {
  assert.match(source(route), /isCertifiedPhotoContent\(/, route + ' must check actual image bytes')
}
// Batch 10 / 95: the id sent to the provenance API must be the id persisted in
// inspection_photos. A storage-filename UUID that is not the row id makes every
// verification request 404 while the UI claims GPS verification succeeded.
const cameraPage = readFileSync(new URL('../app/camera/page.tsx', import.meta.url), 'utf8')
const cameraInsert = cameraPage.match(/from\('inspection_photos'\)\.insert\(\{([\s\S]*?)\n        \}\)/)
assert.ok(cameraInsert, 'camera upload must insert into inspection_photos')
assert.match(cameraInsert[1], /\bid: photoId,/, 'the inserted row id must be the same UUID sent to /api/photo-provenance/verify')
assert.match(cameraPage, /body: JSON\.stringify\(\{ photoId \}\)/, 'verification must use the persisted row id')
console.log('Photo GPS/owner automation gate tests passed.')
