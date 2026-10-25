import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('app/api/cron/warranty-expiry/route.ts', 'utf8')
for (const marker of [
  'CRON_SECRET',
  'createAdminClient',
  "from('warranties')",
  "from('tasks')",
  'automation_key',
  'warranty-expiry:',
  'writeWorkerHeartbeats',
  'expired',
  '.limit(200)',
]) assert.ok(route.includes(marker), `warranty-expiry cron missing: ${marker}`)

assert.ok(!route.includes('SUPABASE_SERVICE_ROLE_KEY'), 'warranty cron must use createAdminClient')

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const paths = (vercel.crons ?? []).map((cron) => cron.path)
assert.ok(paths.includes('/api/cron/warranty-expiry'), 'vercel.json must schedule the warranty-expiry cron')

console.log('warranty-expiry-contract-test: PASS')
