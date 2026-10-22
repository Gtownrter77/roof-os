import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/staging-backup-verify.yml', 'utf8')
assert.ok(workflow.includes('STAGING_PROJECT_REF'))
assert.ok(workflow.includes('db dump'))
assert.ok(workflow.includes('sha256sum'))
assert.ok(workflow.includes('/tmp/roof-os-backup'))
assert.ok(workflow.includes('No database dump or diff is uploaded'))
assert.ok(workflow.includes('not a restore rehearsal'))
assert.ok(!workflow.includes('upload-artifact'), 'backup workflow must not upload database material')

const manual = readFileSync('OWNER-MANUAL.md', 'utf8')
assert.ok(manual.includes('Encrypted backup and a staging restore rehearsal'))
assert.ok(manual.includes('Not yet run'))
console.log('backup-evidence-contract-test: PASS')
