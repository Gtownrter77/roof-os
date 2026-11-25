import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/free-evidence.yml', 'utf8')
const envNames = new Set([...workflow.matchAll(/^ {6}([A-Z][A-Z0-9_]*):/gm)].map((match) => match[1]))
const consumers = {
  seeder: readFileSync('scripts/ci/local-supabase-seed.mjs', 'utf8'),
  isolation: readFileSync('scripts/two-workspace-isolation-test.mjs', 'utf8'),
  readOnly: readFileSync('scripts/authenticated-readonly-smoke.mjs', 'utf8'),
}
const required = {
  ROOF_RLS_TEST_NONPROD: ['isolation', 'readOnly'],
  ROOF_RLS_TEST_CONFIRM: ['isolation', 'readOnly'],
  ROOF_RLS_USER_A_EMAIL: ['seeder', 'isolation', 'readOnly'],
  ROOF_RLS_USER_A_PASSWORD: ['seeder', 'isolation', 'readOnly'],
  ROOF_RLS_USER_B_EMAIL: ['seeder', 'isolation', 'readOnly'],
  ROOF_RLS_USER_B_PASSWORD: ['seeder', 'isolation', 'readOnly'],
}
for (const [name, expectedConsumers] of Object.entries(required)) {
  assert.ok(envNames.has(name), `workflow env is missing ${name}`)
  for (const consumer of expectedConsumers) {
    assert.ok(consumers[consumer].includes(name), `${consumer} does not consume ${name}`)
  }
}
assert.ok(!envNames.has('ROOF_RLS_TEST_PASSWORD'), 'legacy single-password env must not be used by the new pipeline')
assert.ok(
  workflow.includes('| node scripts/ci/normalize-env-output.mjs >> "$GITHUB_ENV"'),
  'Supabase status env values must be normalized before export to GITHUB_ENV',
)
console.log('ci-workflow-env-contract-test: PASS (workflow env matches seeder and RLS consumers)')
