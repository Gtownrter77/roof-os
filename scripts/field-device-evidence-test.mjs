import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const appVersion = JSON.parse(readFileSync('apps/field/app.json', 'utf8')).expo.version
const path = process.argv[2] || 'docs/evidence/field-device-0.4.0.example.json'
const manifest = JSON.parse(readFileSync(path, 'utf8'))
const requiredCases = ['signIn', 'cameraCapture', 'offlineCloseReopen', 'retry', 'privateUpload', 'signOut', 'crossWorkspaceDenial']
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN'])
assert.equal(manifest.manifestVersion, 1)
assert.ok(['android', 'ios'].includes(manifest.platform))
assert.equal(typeof manifest.deviceModel, 'string')
assert.equal(typeof manifest.cases, 'object')
for (const name of requiredCases) assert.ok(statuses.has(manifest.cases[name]), `${name} must be PASS, FAIL, or UNKNOWN`)
assert.ok(Array.isArray(manifest.artifactIds))
if (manifest.status === 'PASS') {
  // Version is derived from the shipped Expo config, not hardcoded, so the
  // gate cannot drift while the field release advances.
  assert.equal(manifest.appVersion, appVersion, `a PASS manifest must match the shipped field version ${appVersion}`)
  assert.ok(manifest.buildId, 'a passing manifest needs a build identifier')
  assert.ok(manifest.testedAt, 'a passing manifest needs a test timestamp')
  assert.ok(manifest.artifactIds.length, 'a passing manifest needs artifact identifiers')
  assert.ok(requiredCases.every((name) => manifest.cases[name] === 'PASS'), 'a passing manifest needs every case to pass')
} else {
  // The checked-in template is not device evidence. Prevent it from being
  // flipped to PASS just to make CI green without a real device run.
  assert.equal(manifest.status, 'UNKNOWN', 'a non-PASS manifest must stay UNKNOWN')
  assert.ok(requiredCases.every((name) => manifest.cases[name] === 'UNKNOWN'), 'template cases must stay UNKNOWN')
}
const serialized = JSON.stringify({ ...manifest, notes: '' })
assert.ok(!/(password|secret|token|supabase_service|@|street|avenue|customer|lead_id|phone)/i.test(serialized), 'manifest must not contain credentials or customer data')
assert.ok(manifest.status !== 'PASS' || manifest.notes?.toLowerCase().includes('success') === false, 'template notes must not contradict status')
const verdict = manifest.status === 'PASS' ? 'PASS' : 'UNVERIFIED'
console.log(`field-device-evidence-test: ${verdict} (${path}; manifest=${manifest.appVersion}, shipped=${appVersion})`)
