import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readEmbeddedLocation, stampLocation, UNABLE_TO_UPLOAD } from '../lib/photos/location.ts'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
assert.equal(readEmbeddedLocation(jpeg), null)
const stamped = stampLocation(jpeg, { latitude: 33.75, longitude: -84.39 })
const found = readEmbeddedLocation(stamped)
assert.ok(found)
assert.ok(Math.abs(found.latitude - 33.75) < 0.001)
assert.ok(Math.abs(found.longitude + 84.39) < 0.001)
assert.equal(UNABLE_TO_UPLOAD, 'unable to upload')
const south = readEmbeddedLocation(stampLocation(jpeg, { latitude: -33.8, longitude: 151.2 }))
assert.ok(south && south.latitude < 0 && south.longitude > 0)
const measure = readFileSync('app/measure/page.tsx', 'utf8')
const field = readFileSync('apps/field/App.tsx', 'utf8')
assert.match(measure, /unable to upload/)
assert.match(measure, /stampLocation/)
assert.match(field, /unable to upload/)
assert.match(field, /embedGpsIntoJpeg/)
console.log('photo-location-test: PASS')
