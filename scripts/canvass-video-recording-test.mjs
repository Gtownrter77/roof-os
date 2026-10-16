import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/canvass/page.tsx', 'utf8')
const recorder = readFileSync('components/CanvassVideoRecorder.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/053_canvass_video_recordings.sql', 'utf8')

assert.ok(page.includes('CanvassVideoRecorder'), 'canvass page must expose the recording workflow')
assert.ok(page.includes('canvass_recordings'), 'each saved lead must receive recording status metadata')
assert.ok(page.includes('canvass-recordings'), 'video must upload to the private recording bucket')
assert.ok(recorder.includes('audio: false'), 'recording must not capture audio')
assert.ok(recorder.includes('consentConfirmed'), 'recording requires explicit consent confirmation')
assert.ok(recorder.includes('disabled={recording || !consentConfirmed}'), 'record button must be blocked without consent')
assert.ok(recorder.includes('video preview'), 'recording UI must make camera/video state visible')
assert.ok(recorder.includes('onRecordingChange(null, null, \'consent_not_obtained\')') === false, 'consent refusal must not be misrepresented as an affirmative recording')
assert.ok(migration.includes('public.canvass_recordings'), 'migration must create recording metadata table')
assert.ok(migration.includes('public.is_workspace_member'), 'metadata and storage must be workspace-scoped')
assert.ok(migration.includes("public = false"), 'recordings bucket must be private')
assert.ok(migration.includes("'consent_not_obtained'"), 'metadata must represent non-recorded leads honestly')
console.log('canvass-video-recording-test: PASS')
