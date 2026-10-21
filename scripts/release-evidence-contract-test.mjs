import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/staging-migration-verify.yml', 'utf8')
assert.ok(workflow.includes('staging-migration'))
assert.ok(workflow.includes('STAGING_DB_URL'))
assert.ok(workflow.includes('STAGING_PROJECT_REF'))
assert.ok(workflow.includes('VERIFY_STAGING_ONLY'))
assert.ok(workflow.includes('migration list'))
assert.ok(workflow.includes('db diff'))
assert.ok(workflow.includes('no production database'))

const docs = [
  'DEPLOYMENT.md',
  'MIGRATION-ORDER.md',
  'SUPABASE-MANUAL-MIGRATION.md',
  'MOBILE-FIELD-RELEASE.md',
]
for (const file of docs) {
  const source = readFileSync(file, 'utf8')
  assert.ok(/unverified|not verified/i.test(source), `${file} must retain unverified boundary language`)
}

const spec = readFileSync('docs/superpowers/specs/2026-10-21-next-ten-release-evidence.md', 'utf8')
assert.ok(spec.includes('Feature shortlist captured while repairing'))
assert.ok(spec.includes('Anti-features remain explicit'))
console.log('release-evidence-contract-test: PASS')
