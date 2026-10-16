import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const page = readFileSync('app/canvass/page.tsx', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

assert.ok(page.includes('triggerHardStop'), 'canvasser must have an explicit hard-stop action')
assert.ok(page.includes('HARD STOP — DISENGAGE NOW'), 'hard-stop state must show a prominent visual alert')
assert.ok(page.includes('playHardStopAlarm'), 'hard-stop action must play the alarm when browser audio is available')
assert.ok(page.includes("outcome: 'DO_NOT_KNOCK'"), 'hard stop must force the do-not-knock outcome')
assert.ok(page.includes('disabled={hardStopActive}'), 'outcome must be locked after hard stop')
assert.ok(page.includes('HARD STOP: '), 'hard-stop reason must be added to the lead activity notes')
assert.ok(page.includes('End the interaction immediately; do not continue pitching.'), 'copy must direct respectful disengagement')
assert.ok(page.includes("await supabase.from('lead_activity').insert("), 'interaction event must be written to CRM activity')
assert.ok(packageJson.scripts['test:canvass-hard-stop'], 'package.json must expose the hard-stop test')
assert.ok(!/CanvassVideoRecorder|canvass_recordings|videoRecording|recordingConsentAt|navigator\.mediaDevices|MediaRecorder|getUserMedia/.test(page), 'canvass page must not record video or use a microphone/camera')
assert.ok(!existsSync('components/CanvassVideoRecorder.tsx'), 'abandoned recorder component must be removed')
assert.ok(!existsSync('supabase/migrations/053_canvass_video_recordings.sql'), 'abandoned video migration must be removed')
assert.ok(!existsSync('scripts/canvass-video-recording-test.mjs'), 'abandoned video test must be removed')

console.log('canvass-hard-stop-test: PASS')
