import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const workflow = read('.github/workflows/mobile-apk.yml')
const provenance = read('scripts/mobile-apk-provenance.mjs')
const app = JSON.parse(read('apps/field/app.json'))
const eas = JSON.parse(read('apps/field/eas.json'))

assert.ok(workflow.includes('workflow_dispatch:'), 'manual preview build remains available')
assert.ok(workflow.includes("tags:\n      - 'field-v*'"), 'versioned field tags must trigger the APK release workflow')
assert.ok(workflow.includes('contents: write'), 'the workflow needs release-upload permission')
assert.ok(workflow.includes('npm install --global eas-cli@27.2.0'), 'EAS CLI must be pinned')
assert.ok(!workflow.includes('eas-cli@latest'), 'unversioned EAS CLI must not be used')
assert.ok(workflow.includes('--git-commit-hash'), 'EAS build lookup must be tied to the checked-out commit')
assert.ok(workflow.includes('SOURCE_SHA'), 'the exact checked-out commit must be recorded')
assert.ok(workflow.includes('Verify APK binary identity and signature'), 'the downloaded APK must be inspected as an Android binary')
assert.ok(workflow.includes('ANDROID_BUILD_TOOLS'), 'the workflow must select Android build-tools explicitly')
assert.ok(provenance.includes('aapt'), 'the provenance manifest must verify the APK package and version from the binary')
assert.ok(provenance.includes('apksigner'), 'the provenance manifest must verify and record the APK signing certificate')
assert.ok(provenance.includes('signingCertificateSha256'), 'the manifest must record the signing certificate fingerprint')
assert.ok(workflow.includes('sha256'), 'APK checksum must be produced')
assert.ok(workflow.includes('mobile-apk-provenance.mjs'), 'the release manifest generator must run')
assert.ok(workflow.includes('roof-os-field-preview.manifest.json'), 'manifest must be included in artifacts')
assert.ok(workflow.includes('roof-os-field-preview.apk.sha256'), 'checksum must be included in artifacts')
assert.ok(workflow.includes('retention-days: 90'), 'APK artifact should be retained for the maximum supported period')
assert.ok(workflow.includes("if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/field-v')"), 'release upload must be restricted to version tags')
assert.ok(workflow.includes('gh release create'), 'tagged APKs must be attached to a GitHub Release')
assert.ok(workflow.includes('--verify-tag'), 'release must verify its source tag')
assert.ok(workflow.includes('--prerelease'), 'internal preview APK releases must be clearly marked as prereleases')

for (const marker of [
  'SOURCE_SHA',
  'SOURCE_REF',
  'EAS_BUILD_ID',
  'EAS_CLI_VERSION',
  'androidPackage',
  'sizeBytes',
  'sha256',
  'repository:',
  'commit:',
  'buildId,',
  'workflowUrl',
]) assert.ok(provenance.includes(marker), `provenance script missing ${marker}`)

assert.equal(app.expo.android.package, 'com.roofos.field')
assert.equal(eas.build.preview.android.buildType, 'apk')
assert.equal(eas.build.production.android.buildType, 'app-bundle')
console.log('mobile-apk-provenance-test: PASS')
