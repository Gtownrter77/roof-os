import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/076_private_passport_rate_limit.sql', 'utf8')
for (const marker of [
  "alter function public.consume_public_rate_limit(text, integer, integer)",
  "set search_path = ''",
  "revoke all on function public.consume_public_rate_limit(text, integer, integer)",
  "from public, anon, authenticated",
  "grant execute on function public.consume_public_rate_limit(text, integer, integer)",
  "to service_role",
  "revoke all on table public.public_access_rate_limits",
  "grant all on table public.public_access_rate_limits",
]) assert.ok(migration.toLowerCase().includes(marker.toLowerCase()), `migration 076 missing: ${marker}`)

console.log('passport-rate-limit-privacy-test: PASS')
