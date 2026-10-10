import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const coach = readFileSync('apps/field/src/fieldCoach.ts', 'utf8')
const app = readFileSync('apps/field/App.tsx', 'utf8')

for (const marker of [
  'suggestCaption',
  'suggestAlbum',
  'formatGeocodedAddress',
  'fieldCoach',
  'measurementNotes',
  'draftNeedsSync',
  'api.weather.gov/alerts/active',
  'ROOF-OS-Field/1.0',
]) {
  assert.ok(coach.includes(marker), `field coach missing ${marker}`)
}
assert.ok(!coach.includes('api.x.ai'), 'field coach must not call a hosted chat API')
assert.ok(!coach.includes('XAI_API_KEY'), 'field coach must not read a hosted chat key')
assert.ok(app.includes("from './src/fieldCoach'"), 'field app must use the on-device coach')
assert.ok(app.includes('draftNeedsSync'), 'sync loop must skip drafts with nothing queued')
assert.ok(app.includes('reverseGeocodeAsync'), 'GPS capture should fill a missing address')
assert.ok(app.includes('arrayBuffer'), 'photo upload should read bytes without an extra blob copy when possible')
assert.ok(app.includes('KeyboardAvoidingView'), 'field inputs should stay above the keyboard')

const { fieldCoach, draftNeedsSync, suggestAlbum, formatGeocodedAddress, measurementNotes, suggestCaption } = await import(
  '../apps/field/src/fieldCoach.ts'
)

assert.equal(suggestCaption('damage'), 'Visible storm damage on the roof')
assert.equal(suggestAlbum('hail bruise on the north slope'), 'damage')
assert.equal(
  formatGeocodedAddress({ streetNumber: '10', street: 'Main St', city: 'Dallas', region: 'GA', postalCode: '30132' }),
  '10 Main St, Dallas, GA, 30132',
)
const items = fieldCoach({
  address: '10 Main',
  hasPoint: true,
  photoCount: 2,
  hasMeasurements: true,
  notes: '',
  synced: false,
  pendingUploads: 2,
})
assert.equal(items.find((item) => item.id === 'property')?.done, true)
assert.equal(items.find((item) => item.id === 'upload')?.done, false)
assert.equal(
  draftNeedsSync({ remoteId: 'abc', verifiedAt: null, technicianName: null, verificationSynced: false, pendingRows: 0 }),
  false,
)
assert.equal(
  draftNeedsSync({ remoteId: 'abc', verifiedAt: 'now', technicianName: 'Ry', verificationSynced: false, pendingRows: 0 }),
  true,
)
assert.ok(measurementNotes({ squares: 20, gutter: 200, eave: 40, pitch: 12 }).some((note) => note.includes('steep')))
console.log('field-coach-test: PASS')
