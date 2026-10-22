import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('scripts/two-workspace-isolation-test.mjs', 'utf8')
for (const marker of [
  'ROOF_RLS_TEST_NONPROD',
  'ROOF_RLS_TEST_CONFIRM',
  'I_UNDERSTAND_SYNTHETIC_DATA',
  'refusing to run against a Vercel URL',
  "from('leads')",
  "storage.from('inspection-photos')",
  '.limit(1)',
  'rls-smoke-',
  'auth.signOut()',
]) assert.ok(source.includes(marker), `RLS harness safety marker missing: ${marker}`)
assert.ok(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), 'RLS harness must never use service role credentials')
console.log('two-workspace-isolation-contract-test: PASS')
