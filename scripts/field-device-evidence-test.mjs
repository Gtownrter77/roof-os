import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const requiredCases = ['signIn', 'cameraCapture', 'offlineCloseReopen', 'retry', 'privateUpload', 'signOut', 'crossWorkspaceDenial']
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN'])

/**
 * Validate a device-evidence manifest. A real FAIL result is preserved as FAIL
 * (and blocks release); only the checked-in template may stay UNKNOWN.
 */
export function validateDeviceEvidenceManifest(manifest, appVersion, sourcePath) {
  const errors = []
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { verdict: 'UNVERIFIED', errors: ['manifest must be an object'], sourcePath }
  }
  if (manifest.manifestVersion !== 1) errors.push('manifestVersion must be 1')
  if (!['android', 'ios'].includes(manifest.platform)) errors.push('platform must be android or ios')
  if (typeof manifest.deviceModel !== 'string') errors.push('deviceModel must be a string')
  if (!manifest.cases || typeof manifest.cases !== 'object' || Array.isArray(manifest.cases)) errors.push('cases must be an object')
  for (const name of requiredCases) {
    if (!statuses.has(manifest.cases?.[name])) errors.push(`${name} must be PASS, FAIL, or UNKNOWN`)
  }
  if (!Array.isArray(manifest.artifactIds)) errors.push('artifactIds must be an array')

  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(manifest.status)) {
    errors.push('status must be PASS, FAIL, or UNKNOWN')
  } else if (manifest.status === 'PASS') {
    // Version is derived from the shipped Expo config, not hardcoded, so the
    // gate cannot drift while the field release advances.
    if (manifest.appVersion !== appVersion) errors.push(`a PASS manifest must match the shipped field version ${appVersion}`)
    if (!manifest.buildId) errors.push('a passing manifest needs a build identifier')
    if (!manifest.testedAt) errors.push('a passing manifest needs a test timestamp')
    if (!manifest.artifactIds?.length) errors.push('a passing manifest needs artifact identifiers')
    if (!requiredCases.every((name) => manifest.cases[name] === 'PASS')) errors.push('a passing manifest needs every case to pass')
  } else if (manifest.status === 'FAIL') {
    if (!requiredCases.some((name) => manifest.cases[name] === 'FAIL')) errors.push('a FAIL manifest needs at least one FAIL case')
    if (typeof manifest.notes !== 'string' || manifest.notes.trim().length < 8) errors.push('a FAIL manifest needs notes explaining the failure')
    if (requiredCases.every((name) => manifest.cases[name] === 'PASS')) errors.push('a FAIL manifest cannot claim every case passed')
  } else {
    // The checked-in template is not device evidence. Prevent it from being
    // flipped to PASS just to make CI green without a real device run.
    if (!requiredCases.every((name) => manifest.cases[name] === 'UNKNOWN')) errors.push('template cases must stay UNKNOWN')
  }

  const serialized = JSON.stringify({ ...manifest, notes: '' })
  if (/(password|secret|token|supabase_service|@|street|avenue|customer|lead_id|phone)/i.test(serialized)) {
    errors.push('manifest must not contain credentials or customer data')
  }
  if (manifest.status === 'PASS' && typeof manifest.notes === 'string' && /success/i.test(manifest.notes)) {
    errors.push('template notes must not contradict status')
  }

  const verdict = manifest.status === 'PASS' ? 'PASS' : manifest.status === 'FAIL' ? 'FAIL' : 'UNVERIFIED'
  return { verdict, errors, sourcePath }
}

function main() {
  const appVersion = JSON.parse(readFileSync('apps/field/app.json', 'utf8')).expo.version
  const path = process.argv[2] || 'docs/evidence/field-device-0.4.0.example.json'
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const result = validateDeviceEvidenceManifest(manifest, appVersion, path)
  assert.deepEqual(result.errors, [], `invalid device manifest: ${result.errors.join('; ')}`)
  if (result.verdict === 'FAIL') {
    console.error(`field-device-evidence-test: FAIL (${path}; a real device case failed; release blocked)`)
    process.exit(1)
  }
  console.log(`field-device-evidence-test: ${result.verdict} (${path}; manifest=${manifest.appVersion}, shipped=${appVersion})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
