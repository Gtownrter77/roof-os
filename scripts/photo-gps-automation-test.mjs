import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
const worker = source('workers/inspection-quality.ts')
assert.match(worker, /filter\(\(photo\) => photo\.gps_verified === true\)/)
assert.match(source('app/api/photo-to-report/route.ts'), /enable_auto_photo_measurements/)
console.log('Photo GPS/owner automation gate tests passed.')
