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
  ROOF_RLS_TEST_NONPROD: ['seeder', 'isolation', 'readOnly'],
  ROOF_RLS_TEST_CONFIRM: ['seeder', 'isolation', 'readOnly'],
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
  workflow.includes("w.trial_status = 'active' and (w.trial_expires_at is null or w.trial_expires_at > now())"),
  'workspace resolution must reject pending or expired trial workspaces',
)
assert.ok(
  consumers.seeder.includes('trial_status: \'active\''),
  'seeder must activate synthetic workspaces that current_workspace_id() refuses while pending',
)
assert.ok(
  workflow.includes('| node scripts/ci/normalize-env-output.mjs >> "$GITHUB_ENV"'),
  'Supabase status env values must be normalized before export to GITHUB_ENV',
)
for (const line of [
  'echo "SUPABASE_URL=$API_URL" >> "$GITHUB_ENV"',
  'echo "SUPABASE_ANON_KEY=$ANON_KEY" >> "$GITHUB_ENV"',
  'echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> "$GITHUB_ENV"',
]) {
  assert.ok(workflow.includes(line), `workflow must export ${line}`)
}
const generatedSummary = 'node scripts/release-gate-summary.mjs docs/evidence/release-gates.json /tmp/roof-os-release-summary.md'
assert.ok(
  workflow.includes(generatedSummary),
  'generated evidence must be summarized from the written file, not the pre-evidence default',
)
assert.ok(
  !workflow.includes('npm run test:release-gate-summary'),
  'the evidence workflow must not rerun the pre-evidence summary test after writing PASS gates',
)
assert.ok(
  workflow.includes('npm run ci:assert-evidence -- docs/evidence/release-gates.json docs/evidence/release-gates.provenance.json'),
  'generated evidence must be asserted for provenance and physicalDevice UNKNOWN',
)
console.log('ci-workflow-env-contract-test: PASS (workflow env matches seeder and RLS consumers, generated evidence guarded)')
