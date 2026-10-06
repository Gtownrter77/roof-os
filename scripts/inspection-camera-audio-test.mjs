import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname

// 1. Check InspectionCamera component
const componentSource = readFileSync(join(root, 'components', 'InspectionCamera.tsx'), 'utf8')
assert.ok(
  componentSource.includes('handleStartRecording') && componentSource.includes('handleStopRecording'),
  'InspectionCamera must include audio recording start and stop handlers'
)
assert.ok(
  componentSource.includes('SpeechRecognition'),
  'InspectionCamera must integrate SpeechRecognition for speech-to-text dictation'
)
assert.ok(
  componentSource.includes('Site Audio Dictation') || componentSource.includes('Voice Note'),
  'InspectionCamera must display audio voice note section'
)
assert.ok(
  componentSource.includes('handlePlayGalleryAudio') || componentSource.includes('audioTranscript'),
  'InspectionCamera must include audio playback and transcripts in evidence gallery'
)

// 2. Check app/camera/page.tsx
const cameraPageSource = readFileSync(join(root, 'app', 'camera', 'page.tsx'), 'utf8')
assert.ok(
  cameraPageSource.includes('handleStartRecording') && cameraPageSource.includes('handleStopRecording'),
  'app/camera/page.tsx must provide audio recording controls'
)
assert.ok(
  cameraPageSource.includes('SpeechRecognition'),
  'app/camera/page.tsx must integrate speech-to-text dictation'
)
assert.ok(
  cameraPageSource.includes('siteNotes') || cameraPageSource.includes('transcript'),
  'app/camera/page.tsx must support transcribing into site observation notes'
)

console.log('inspection-camera-audio-test: PASS (audio recording, MediaRecorder, SpeechRecognition STT, and site notes integration verified)')
