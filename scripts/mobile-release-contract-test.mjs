import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const app = JSON.parse(readFileSync('apps/field/app.json', 'utf8'))
const eas = JSON.parse(readFileSync('apps/field/eas.json', 'utf8'))
const document = readFileSync('MOBILE-FIELD-RELEASE.md', 'utf8')
const workflow = readFileSync('.github/workflows/mobile-apk.yml', 'utf8')
const source = readFileSync('apps/field/App.tsx', 'utf8')
const fieldDir = resolve('apps/field')
assert.equal(app.expo.version, '0.5.0')
assert.equal(eas.cli.appVersionSource, 'remote')

assert.equal(eas.cli.version, '>=27.2.0')

assert.equal(eas.build.preview.distribution, 'internal')
assert.equal(eas.build.preview.android.buildType, 'apk')
assert.equal(eas.build.preview.autoIncrement, true)
assert.equal(eas.build.production.autoIncrement, undefined)
assert.ok(document.includes('ROOF/OS Field Mobile Release 0.5.0'))
assert.ok(document.includes('The app version is `0.5.0`'))
assert.ok(document.includes('physical-device'))
assert.ok(document.includes('two-workspace'))

assert.ok(workflow.includes('APP_VERSION') && workflow.includes('field-v$APP_VERSION'), 'tagged APK releases must match apps/field/app.json')
assert.ok(workflow.includes('Expected field release 0.5.0'), 'APK workflow must reject stale app versions')
assert.ok(workflow.includes('npm install --global eas-cli@27.2.0'), 'EAS CLI must remain pinned')
assert.ok(workflow.includes('SOURCE_SHA') && workflow.includes('steps.source.outputs.source_sha'), 'APK provenance must record the exact resolved source commit')
assert.ok(workflow.includes('git rev-parse HEAD') || readFileSync('scripts/mobile-apk-provenance.mjs', 'utf8').includes("execFileSync('git', ['rev-parse', 'HEAD']"), 'the built APK must be verified against the checked-out source commit')
assert.ok(workflow.includes('roof-os-field-preview.manifest.json') && workflow.includes('roof-os-field-preview.apk.sha256'), 'APK download must include a provenance manifest and SHA-256')
assert.ok(workflow.includes('gh release create') && workflow.includes('--verify-tag'), 'version-tagged APK must publish a verified GitHub Release')

assert.ok(source.includes('Retry this inspection now'))
assert.ok(source.includes('Local inspection drafts remain safely stored'))
assert.ok(source.includes('session expired'))
assert.ok(source.includes("client_version: 'field-0.5.0'"))
assert.ok(source.includes('Field release 0.5.0'))

const provenanceImport = source.match(/from ['"](\.\.\/\.\.\/lib\/photo-provenance(?:\.mjs)?)['"]/)
assert.ok(provenanceImport, 'Field App must import the shared photo-provenance module')
const importedPath = resolve(fieldDir, provenanceImport[1])
assert.equal(existsSync(importedPath), true, `Imported photo-provenance file must exist at ${importedPath}`)

const metroCandidates = ['metro.config.cjs', 'metro.config.js']
const metroFile = metroCandidates.find((name) => existsSync(join(fieldDir, name)))
assert.ok(metroFile, 'Field Metro config must exist so EAS can resolve files outside apps/field')
const metro = readFileSync(join(fieldDir, metroFile), 'utf8')
assert.match(metro, /watchFolders/, 'Metro must watch the repository root so ../../lib resolves during APK bundling')
assert.match(metro, /sourceExts/, 'Metro must include .mjs so photo-provenance.mjs bundles')
assert.match(metro, /getDefaultConfig/, 'Metro config must extend Expo defaults')
assert.ok(
  !source.includes('Using fallback production Supabase credentials'),
  'Login copy must not claim fallback credentials when none are bundled',
)

console.log('mobile-release-contract-test: PASS')
