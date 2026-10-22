import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('app/api/cron/heartbeat/route.ts', 'utf8')
const workflow = readFileSync('.github/workflows/staging-heartbeat-probe.yml', 'utf8')
for (const forbidden of ['action-executor', 'twilio', 'retailer', 'payment', 'claims']) assert.ok(!route.toLowerCase().includes(forbidden), `heartbeat route must not include ${forbidden}`)
for (const marker of ['CRON_SECRET', 'heartbeat-only', 'writeWorkerHeartbeats']) assert.ok(route.includes(marker), marker)
for (const marker of ['workflow_dispatch', 'environment: staging-heartbeat', 'STAGING_PROJECT_REF', 'PRODUCTION_SUPABASE_HOST', 'VERIFY_STAGING_ONLY', 'CRON_SECRET', '/api/cron/heartbeat', 'heartbeat-only']) assert.ok(workflow.includes(marker), marker)
assert.ok(!workflow.includes('push:') && !workflow.includes('pull_request:') && !workflow.includes('upload-artifact'))
console.log('heartbeat-probe-contract-test: PASS')
