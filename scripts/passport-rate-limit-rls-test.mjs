import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/078_explicitly_deny_public_rate_limit_clients.sql', 'utf8')
assert.ok(migration.includes('public_access_rate_limits'), 'migration must target the rate-limit table')
assert.ok(migration.includes('deny_client_roles'), 'migration must use a stable explicit-deny policy')
assert.ok(migration.includes('for all to anon, authenticated using (false) with check (false)'), 'client roles must be denied for every operation')
assert.ok(migration.includes('from pg_policies'), 'migration must be safe to reapply')
console.log('passport-rate-limit-rls-test: PASS')
