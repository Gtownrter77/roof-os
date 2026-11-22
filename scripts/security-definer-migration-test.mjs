import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationDir = 'supabase/migrations'
const files = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()

// Delimiter-aware: dollar-quoted bodies may use $$, $function$, or any tagged
// delimiter. The old $$ only pattern silently skipped 11 SECURITY DEFINER
// functions, reporting PASS over an incomplete corpus.
const functionBodyPattern = /create\s+(?:or\s+replace\s+)?function\b[\s\S]*?\bas\s+\$([A-Za-z_0-9]*)\$[\s\S]*?\$\1\$\s*;/gi
let functions = 0
let taggedBodies = 0
for (const file of files) {
  const source = readFileSync(join(migrationDir, file), 'utf8')
  for (const match of source.matchAll(functionBodyPattern)) {
    if (!/security\s+definer/i.test(match[0])) continue
    functions += 1
    if (match[1]) taggedBodies += 1
    assert.match(
      match[0],
      /set\s+search_path\s*(?:=|to\s)/i,
      `${file}: SECURITY DEFINER function lacks explicit search_path (delimiter $${match[1]}$)`,
    )
  }
}

// Independent cross-check that does not depend on dollar-quote delimiters:
// slice each source at every CREATE FUNCTION statement and count slices that
// declare SECURITY DEFINER. A blind spot in functionBodyPattern would diverge.
let independentCount = 0
for (const file of files) {
  const source = readFileSync(join(migrationDir, file), 'utf8')
  const starts = [...source.matchAll(/create\s+(?:or\s+replace\s+)?function\b/gi)].map((m) => m.index)
  for (let i = 0; i < starts.length; i += 1) {
    if (/security\s+definer/i.test(source.slice(starts[i], starts[i + 1] ?? source.length))) independentCount += 1
  }
}
assert.equal(functions, independentCount, 'SECURITY DEFINER parser must cover every function statement')
assert.ok(taggedBodies > 0, 'parser must cover tagged dollar-quoted bodies, not only $$')
assert.ok(functions > 0, 'expected at least one SECURITY DEFINER function')

const hardening = readFileSync(join(migrationDir, '031_security_definer_least_privilege.sql'), 'utf8')
assert.match(hardening, /revoke\s+all\s+on\s+function/i, 'least-privilege migration must revoke broad function access')
assert.match(hardening, /grant\s+execute\s+on\s+function/i, 'least-privilege migration must grant explicit execution access')
const ledger = readFileSync(join(migrationDir, '053_agent_action_ledger.sql'), 'utf8')
assert.match(ledger, /revoke\s+all\s+on\s+function\s+public\.approve_agent_action_batch/i)
assert.match(ledger, /grant\s+execute\s+on\s+function\s+public\.approve_agent_action_batch[\s\S]*to authenticated/i)
console.log(`security-definer-migration-test: PASS (${functions} SECURITY DEFINER functions checked, ${taggedBodies} tagged bodies; all have explicit search paths)`)
