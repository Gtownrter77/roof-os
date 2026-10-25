import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/055_passport_public_share.sql', 'utf8')
for (const marker of ['public_token', 'public_shared', 'public_shared_at', 'roof_passports_public_token_idx']) {
  assert.ok(migration.includes(marker), `passport share migration missing: ${marker}`)
}
assert.ok(!/create policy/i.test(migration), 'public share must not add an anonymous RLS policy')

const publicRoute = readFileSync('app/api/passport/public/route.ts', 'utf8')
for (const marker of ['createAdminClient', ".eq('public_shared', true)", ".eq('public_token', token)", 'isUuid', 'PUBLIC_FIELDS', '.limit(1)']) {
  assert.ok(publicRoute.includes(marker), `public passport route missing: ${marker}`)
}
assert.ok(!publicRoute.includes('SUPABASE_SERVICE_ROLE_KEY'), 'public route must rely on createAdminClient, not inline secrets')

const shareRoute = readFileSync('app/api/passport/[id]/share/route.ts', 'utf8')
for (const marker of ['auth.getUser()', 'is_workspace_admin', 'public_shared: true', 'public_shared: false']) {
  assert.ok(shareRoute.includes(marker), `passport share route missing: ${marker}`)
}

const page = readFileSync('app/passport/share/[token]/page.tsx', 'utf8')
assert.ok(page.includes('/api/passport/public?token='), 'shared passport page must read from the public route')

console.log('passport-public-share-contract-test: PASS')
