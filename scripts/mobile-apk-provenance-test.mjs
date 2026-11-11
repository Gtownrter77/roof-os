import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractSigningCertificateSha256 } from './mobile-apk-signature.mjs'

const read = (path) => readFileSync(path, 'utf8')
const workflow = read('.github/workflows/mobile-apk.yml')
const provenance = read('scripts/mobile-apk-provenance.mjs')
const app = JSON.parse(read('apps/field/app.json'))

const fingerprint = 'ab'.repeat(32)
const colonFingerprint = fingerprint.match(/.{2}/g).join(':').toUpperCase()
assert.deepEqual(
  extractSigningCertificateSha256(`Signer #1 certificate SHA-256 digest: ${colonFingerprint}`),
  { fingerprint, source: 'signer_label' },
  'normal apksigner output extracts the labeled certificate fingerprint without warning',
)
assert.deepEqual(
  extractSigningCertificateSha256(`Certificate SHA-256: ${fingerprint}`),
  { fingerprint, source: 'certificate_label' },
  'certificate-labeled alternate output extracts the certificate fingerprint',
)
assert.deepEqual(
  extractSigningCertificateSha256([
    `Certificate SHA-256 digest: ${colonFingerprint}`,
    `Public key SHA-256 digest: ${'cd'.repeat(32)}`,
  ].join('\n')),
  { fingerprint, source: 'certificate_label' },
  'certificate digest is selected without confusing it with the public-key digest',
)
assert.throws(
  () => extractSigningCertificateSha256([
    `Signer #1 certificate SHA-256 digest: ${fingerprint}`,
    `Signer #2 certificate SHA-256 digest: ${'cd'.repeat(32)}`,
  ].join('\n')),
  /multiple certificate SHA-256 fingerprints/,
  'multiple signer certificates are rejected as an ambiguous signing identity',
)
assert.deepEqual(
  extractSigningCertificateSha256(`SHA-256: ${fingerprint}`),
  { fingerprint, source: 'fallback' },
  'unlabeled legacy SHA-256 output remains supported when unambiguous',
)
assert.deepEqual(
  extractSigningCertificateSha256(`\u001b[32mSigner #1 certificate SHA-256 digest: ${colonFingerprint}\u001b[0m`),
  { fingerprint, source: 'signer_label' },
  'ANSI color codes are stripped before parsing signer certificate fingerprints',
)
assert.throws(
  () => extractSigningCertificateSha256('apksigner returned no certificate digest'),
  /fingerprint is missing/,
  'missing signing identity is rejected',
)

const eas = JSON.parse(read('apps/field/eas.json'))

assert.ok(workflow.includes('workflow_dispatch:'), 'manual preview build remains available')
assert.ok(workflow.includes("github.event_name == 'workflow_dispatch' && 'main' || github.ref"), 'manual builds must be pinned to protected main rather than arbitrary user refs')
const buildJob = workflow.slice(workflow.indexOf('build-preview-apk:'), workflow.indexOf('publish-preview-release:'))
assert.ok(!buildJob.includes('contents: write'), 'the EAS build job must not have GitHub write permission')
assert.ok(!buildJob.includes('gh release create'), 'the EAS build job must not publish releases')
assert.ok(workflow.includes('publish-preview-release:'), 'tagged release publication must use a separate job')
assert.ok(workflow.includes('needs: build-preview-apk'), 'release publication must depend on the completed build job')
assert.ok(workflow.includes('actions/download-artifact@v5'), 'release publication must consume the built artifact without rerunning repository code')
assert.ok(workflow.includes("tags:\n      - 'field-v*'"), 'versioned field tags must trigger the APK release workflow')
assert.ok(workflow.includes('contents: write'), 'the workflow needs release-upload permission')
assert.ok(workflow.includes('npm install --global eas-cli@27.2.0'), 'EAS CLI must be pinned')
assert.ok(!workflow.includes('eas-cli@latest'), 'unversioned EAS CLI must not be used')
assert.ok(workflow.includes('--local'), 'APK must build on the GitHub runner without consuming EAS cloud build quota')
assert.ok(workflow.includes("eas env:exec preview"), 'local build must receive the protected EAS preview environment variables')
assert.ok(workflow.includes('--output ../../artifacts/roof-os-field-preview.apk'), 'local EAS build must write the exact APK artifact path')
assert.ok(!workflow.includes('eas build:list'), 'local APK builds must not query a cloud build record')
assert.ok(!workflow.includes('eas build:download'), 'local APK builds must not download a remote artifact')
assert.ok(workflow.includes('build_id=local-${GITHUB_RUN_ID}'), 'local build provenance must use a clearly labeled local run identifier')
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
