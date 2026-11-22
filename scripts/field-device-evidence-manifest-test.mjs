import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateDeviceEvidenceManifest } from './field-device-evidence-test.mjs'

const APP_VERSION = '0.5.0'
const CASES = {
  signIn: 'PASS',
  cameraCapture: 'FAIL',
  offlineCloseReopen: 'UNKNOWN',
  retry: 'PASS',
  privateUpload: 'PASS',
  signOut: 'PASS',
  crossWorkspaceDenial: 'PASS',
}
const manifest = (overrides = {}) => ({
  manifestVersion: 1,
  status: 'FAIL',
  appVersion: APP_VERSION,
  platform: 'android',
  deviceModel: 'REDACTED',
  buildId: 'build-1',
  testedAt: '2026-11-22T00:00:00.000Z',
  artifactIds: ['artifact-1'],
  cases: { ...CASES },
  notes: 'Camera capture failed on the device; release blocked pending a fix.',
  ...overrides,
})

// A real device run that failed a case must be recorded as FAIL, not coerced to
// UNKNOWN or rejected as if the evidence were malformed.
const failed = validateDeviceEvidenceManifest(manifest(), APP_VERSION, 'fake-path.json')
assert.deepEqual(failed.errors, [], 'a genuine FAIL manifest must validate')
assert.equal(failed.verdict, 'FAIL', 'a device failure must be reported as FAIL, not UNVERIFIED')

const missingFailure = validateDeviceEvidenceManifest(manifest({ cases: { ...CASES, cameraCapture: 'PASS' } }), APP_VERSION, 'fake-path.json')
assert.ok(missingFailure.errors.some((error) => /at least one FAIL case/.test(error)), 'FAIL status requires a FAIL case')
const missingNotes = validateDeviceEvidenceManifest(manifest({ notes: '' }), APP_VERSION, 'fake-path.json')
assert.ok(missingNotes.errors.some((error) => /notes/.test(error)), 'FAIL status requires an operator note')

const passing = validateDeviceEvidenceManifest(
  manifest({ status: 'PASS', cases: Object.fromEntries(Object.keys(CASES).map((key) => [key, 'PASS'])) }),
  APP_VERSION,
  'fake-path.json'
)
assert.deepEqual(passing.errors, [])
assert.equal(passing.verdict, 'PASS')
const wrongVersion = validateDeviceEvidenceManifest(
  manifest({ status: 'PASS', appVersion: '0.4.0', cases: Object.fromEntries(Object.keys(CASES).map((key) => [key, 'PASS'])) }),
  APP_VERSION,
  'fake-path.json'
)
assert.ok(wrongVersion.errors.some((error) => /shipped field version/.test(error)), 'PASS must match the shipped version')

const unknown = validateDeviceEvidenceManifest(
  manifest({ status: 'UNKNOWN', buildId: null, testedAt: null, artifactIds: [], notes: 'Template only.', cases: Object.fromEntries(Object.keys(CASES).map((key) => [key, 'UNKNOWN'])) }),
  APP_VERSION,
  'fake-path.json'
)
assert.deepEqual(unknown.errors, [])
assert.equal(unknown.verdict, 'UNVERIFIED', 'UNKNOWN remains an honest unverified verdict')

const source = readFileSync(new URL('./field-device-evidence-test.mjs', import.meta.url), 'utf8')
assert.match(source, /status === 'FAIL'/, 'the validator must handle FAIL status explicitly')
assert.match(source, /verdict === 'FAIL'[\s\S]{0,120}process\.exit\(1\)/, 'a recorded device failure must fail the gate')

console.log('field-device-evidence-manifest-test: PASS (FAIL evidence preserved and gate-blocking; PASS strict; UNKNOWN unverified)')
