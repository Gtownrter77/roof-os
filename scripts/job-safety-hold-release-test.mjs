import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const original = readFileSync('supabase/migrations/109_foreman_sos.sql', 'utf8')
const followUp = readFileSync('supabase/migrations/110_release_job_safety_hold.sql', 'utf8')

// The original migration created a hold with no way to release it. This test
// locks in that diagnosis and the forward-only (new migration) remedy.
assert.doesNotMatch(original, /create\s+(?:or\s+replace\s+)?function\s+public\.release_job_safety_hold/i)

for (const [label, pattern] of [
  ['authorized release RPC', /create\s+or\s+replace\s+function\s+public\.release_job_safety_hold\s*\(\s*incident\s+uuid\s*\)/i],
  ['privileged execution', /security\s+definer/i],
  ['closed search path', /set\s+search_path\s*=\s*''/],
  ['workspace admin check', /public\.is_workspace_admin\s*\(\s*j\.workspace_id\s*\)/],
  ['release timestamp', /released_at\s*=\s*now\(\)/i],
  ['release actor', /released_by\s*=\s*auth\.uid\(\)/i],
  ['revoke public execute', /revoke\s+all\s+on\s+function\s+public\.release_job_safety_hold\s*\(uuid\)\s+from\s+public,\s*anon/i],
  ['grant to authenticated', /grant\s+execute\s+on\s+function\s+public\.release_job_safety_hold\s*\(uuid\)\s+to\s+authenticated/i],
  ['least-privilege trigger function', /revoke\s+all\s+on\s+function\s+public\.enforce_job_safety_hold\(\)\s+from\s+public,\s*anon,\s*authenticated/i],
]) {
  assert.match(followUp, pattern, label)
}

console.log('job-safety-hold-release-test: PASS (authorized release path exists; no applied migration was edited)')
