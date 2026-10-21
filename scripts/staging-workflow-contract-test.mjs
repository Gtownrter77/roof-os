import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = [
  '.github/workflows/staging-migration-verify.yml',
  '.github/workflows/staging-backup-verify.yml',
  '.github/workflows/staging-rls-smoke.yml',
]
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  assert.ok(source.includes('workflow_dispatch'), `${file} must be manual only`)
  assert.ok(source.includes('environment:'), `${file} must use a protected environment`)
  assert.ok(source.includes('STAGING_PROJECT_REF'), `${file} must require staging project identity`)
  assert.ok(source.includes('PRODUCTION_SUPABASE_HOST'), `${file} must reject the production host`)
  assert.ok(source.includes('does not contain the allowlisted STAGING_PROJECT_REF'), `${file} must fail closed on target mismatch`)
}
const rls = readFileSync('.github/workflows/staging-rls-smoke.yml', 'utf8')
assert.ok(!rls.includes('pull_request:') && !rls.includes('push:'), 'RLS smoke must not run automatically')
assert.ok(rls.includes('I_UNDERSTAND_SYNTHETIC_DATA'))
assert.ok(rls.includes('ROOF_RLS_TEST_NONPROD'))
assert.ok(rls.includes('test:two-workspace-isolation'))
assert.ok(rls.includes('cleanup'), 'RLS workflow must state cleanup boundary')
console.log('staging-workflow-contract-test: PASS')
