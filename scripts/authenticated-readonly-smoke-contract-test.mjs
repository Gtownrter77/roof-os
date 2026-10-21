import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const script = readFileSync('scripts/authenticated-readonly-smoke.mjs', 'utf8')
const workflow = readFileSync('.github/workflows/staging-auth-readonly-smoke.yml', 'utf8')
for (const forbidden of ['.insert(', '.update(', '.delete(', '.upsert(', '.upload(', '.remove(']) assert.ok(!script.includes(forbidden), `read-only smoke must not contain ${forbidden}`)
for (const marker of ['signInWithPassword', 'current_workspace_id', "from('workspaces')", "from('leads')", "from('inspection-photos')", 'signOut']) assert.ok(script.includes(marker), marker)
for (const marker of ['workflow_dispatch', 'environment: staging-auth', 'STAGING_PROJECT_REF', 'I_UNDERSTAND_SYNTHETIC_DATA', 'test:authenticated-readonly-smoke', 'No inserts']) assert.ok(workflow.includes(marker), marker)
assert.ok(!workflow.includes('push:') && !workflow.includes('pull_request:'))
console.log('authenticated-readonly-smoke-contract-test: PASS')
