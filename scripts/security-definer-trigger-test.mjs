import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/075_harden_security_definer_triggers.sql', 'utf8')
assert.match(migration, /p\.prosecdef/i, 'migration must target SECURITY DEFINER functions only')
assert.match(migration, /p\.prorettype\s*=\s*'trigger'::regtype/i, 'migration must target trigger-only functions')
assert.match(migration, /ALTER FUNCTION %s SET search_path = %L/i, 'trigger functions must receive an empty search_path')
assert.match(migration, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/i, 'trigger functions must not be directly callable through API roles')
assert.match(migration, /to_regprocedure\('public\.is_estimate_admin\(uuid\)'\)/i, 'migration must tolerate test schemas where migration 059 is not installed')
assert.match(migration, /ALTER FUNCTION %s SET search_path = %L/i, 'admin helper must use an empty search_path when present')
assert.match(migration, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon/i, 'admin helper must not be anonymous')
assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO authenticated/i, 'authenticated RLS policies must retain helper access')
console.log('security-definer-trigger-test: PASS')
