import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_FIELD_AI_PREFERENCES,
  aiRequestExpiry,
  parseFieldAiPreferences,
  photoAiRequestStatusLabel,
  photoEvidencePrompts,
  serializeFieldAiPreferences,
} from '../apps/field/src/ai/photoAssistance.ts'

assert.deepEqual(DEFAULT_FIELD_AI_PREFERENCES, {
  photoCaptionAlbumEnabled: false,
  photoCompletenessEnabled: false,
  requestRetentionDays: 7,
})
assert.deepEqual(parseFieldAiPreferences('{bad json'), DEFAULT_FIELD_AI_PREFERENCES)
assert.equal(parseFieldAiPreferences('{"photoCaptionAlbumEnabled":true,"requestRetentionDays":365}').photoCaptionAlbumEnabled, true)
assert.equal(parseFieldAiPreferences('{"photoCaptionAlbumEnabled":true,"requestRetentionDays":365}').requestRetentionDays, 7)
const encoded = serializeFieldAiPreferences({ photoCaptionAlbumEnabled: true, photoCompletenessEnabled: false, requestRetentionDays: 30 })
assert.deepEqual(parseFieldAiPreferences(encoded), { photoCaptionAlbumEnabled: true, photoCompletenessEnabled: false, requestRetentionDays: 30 })
assert.equal(aiRequestExpiry('2026-11-04T12:00:00.000Z', 7), '2026-11-11T12:00:00.000Z')
assert.throws(() => aiRequestExpiry('invalid', 7), /valid request timestamp/)

const gaps = photoEvidencePrompts(['general', 'before'], true)
assert.deepEqual(gaps.map((item) => item.album), ['damage', 'measurements'])
assert.equal(gaps[0].conditional, true, 'damage prompts stay conditional and do not claim damage exists')
assert.deepEqual(photoEvidencePrompts(['general', 'before', 'damage', 'measurements'], true), [])
assert.equal(photoEvidencePrompts([], false).some((item) => item.album === 'measurements'), false)

assert.equal(photoAiRequestStatusLabel('waiting_for_upload'), 'AI request waiting for photo upload')
assert.match(photoAiRequestStatusLabel('pending_analysis'), /no local AI model is available/)
assert.equal(photoAiRequestStatusLabel('pending_analysis', true), 'AI analysis queued')
assert.equal(photoAiRequestStatusLabel('completed', true), 'AI suggestion ready for technician review')
assert.equal(photoAiRequestStatusLabel(null), null)

const app = readFileSync('apps/field/App.tsx', 'utf8')
const nativeDb = readFileSync('apps/field/src/localDb.ts', 'utf8')
const assistance = readFileSync('apps/field/src/ai/photoAssistance.ts', 'utf8')
for (const [name, source] of [['field app', app], ['native database', nativeDb]]) {
  assert.ok(source.includes('inspection_ai_request_queue'), `${name} must create/read the durable request queue`)
  assert.ok(source.includes('waiting_for_upload'), `${name} must retain the waiting-for-upload state`)
  assert.ok(source.includes('pending_analysis'), `${name} must distinguish pending analysis from upload`)
}
assert.ok(assistance.includes('no local AI model is available in this build'), 'the app must not imply inference ran without a model')
assert.ok(app.includes('SecureStore.getItemAsync'), 'operator preferences must be loaded from local secure storage')
assert.ok(app.includes('photoEvidencePrompts'), 'the field screen must show deterministic photo evidence prompts')
console.log('field-ai-assistance-test: PASS')
