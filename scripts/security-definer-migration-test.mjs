import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationDir = 'supabase/migrations'
const files = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()
let functions = 0
for (const file of files) {
  const source = readFileSync(join(migrationDir, file), 'utf8')
  const blocks = source.match(/create(?: or replace)? function[\s\S]*?\$\$;/gi) ?? []
  for (const block of blocks) {
    if (!/security\s+definer/i.test(block)) continue
    functions += 1
    assert.match(block, /set\s+search_path\s*=/i, `${file}: SECURITY DEFINER function lacks explicit search_path`)
  }
}
assert.ok(functions > 0, 'expected at least one SECURITY DEFINER function')
const hardening = readFileSync(join(migrationDir, '031_security_definer_least_privilege.sql'), 'utf8')
assert.match(hardening, /revoke\s+all\s+on\s+function/i, 'least-privilege migration must revoke broad function access')
assert.match(hardening, /grant\s+execute\s+on\s+function/i, 'least-privilege migration must grant explicit execution access')
const ledger = readFileSync(join(migrationDir, '053_agent_action_ledger.sql'), 'utf8')
assert.match(ledger, /revoke\s+all\s+on\s+function\s+public\.approve_agent_action_batch/i)
assert.match(ledger, /grant\s+execute\s+on\s+function\s+public\.approve_agent_action_batch[\s\S]*to authenticated/i)
console.log(`security-definer-migration-test: PASS (${functions} SECURITY DEFINER functions have explicit search paths)`)
