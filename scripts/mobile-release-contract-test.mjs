import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = JSON.parse(readFileSync('apps/field/app.json', 'utf8'))
const document = readFileSync('MOBILE-FIELD-RELEASE.md', 'utf8')
const workflow = readFileSync('.github/workflows/mobile-apk.yml', 'utf8')
const source = readFileSync('apps/field/App.tsx', 'utf8')
assert.equal(app.expo.version, '0.4.0')
assert.ok(document.includes('Field Mobile Release 0.4.0'))
assert.ok(document.includes('The app version is `0.4.0`'))
assert.ok(document.includes('physical-device'))
assert.ok(document.includes('two-workspace'))
assert.ok(workflow.includes("Expected field release 0.4.0"))
assert.ok(source.includes('Retry this inspection now'))
assert.ok(source.includes('Local inspection drafts remain safely stored'))
assert.ok(source.includes('session expired'))
console.log('mobile-release-contract-test: PASS')
