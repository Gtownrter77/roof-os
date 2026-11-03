import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/077_harden_remaining_security_definers.sql', 'utf8')
assert.ok(migration.includes("n.nspname = 'public'"), 'migration must scope the hardening to public schema functions')
assert.ok(migration.includes('p.prosecdef'), 'migration must only change SECURITY DEFINER functions')
assert.ok(migration.includes("array['search_path=""']"), 'migration must skip functions already hardened')
assert.ok(migration.includes('ALTER FUNCTION %s SET search_path = %L'), 'migration must set an empty search_path')
assert.ok(!/revoke\s+execute/i.test(migration), 'migration must preserve existing helper/RPC execute grants')
console.log('security-definer-search-path-test: PASS')
