import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const proxy = readFileSync('proxy.ts', 'utf8')
for (const marker of ['isPublicPassportPath', "'/passport/share'", "'Referrer-Policy'", "'no-referrer'", "'X-Robots-Tag'", "'noindex, nofollow'"]) {
  assert.ok(proxy.includes(marker), `proxy missing public passport guard: ${marker}`)
}
assert.ok(proxy.includes('!isPublicPassportPath(pathname)'), 'unauthenticated HTML redirect must exempt public passport paths')

const publicRoute = readFileSync('app/api/passport/public/route.ts', 'utf8')
for (const marker of ['consume_public_rate_limit', 'status: 429', "'Retry-After'", "'Cache-Control': 'no-store'", 'createHash']) {
  assert.ok(publicRoute.includes(marker), `public passport route missing hardening: ${marker}`)
}

const migration = readFileSync('supabase/migrations/056_public_passport_rate_limit.sql', 'utf8')
for (const marker of [
  'public_access_rate_limits',
  'consume_public_rate_limit',
  'enable row level security',
  'security definer',
  'set search_path = public',
  'revoke all on function',
  'grant execute on function',
  'to service_role',
  'primary key (bucket, window_start)',
]) assert.ok(migration.includes(marker), `rate-limit migration missing: ${marker}`)

const page = readFileSync('app/passport/[id]/page.tsx', 'utf8')
for (const marker of ['/api/passport/${passport.id}/share', 'public_shared', 'public_token', 'navigator.clipboard', 'Publish homeowner link', 'Unpublish']) {
  assert.ok(page.includes(marker), `passport page missing share control: ${marker}`)
}

console.log('passport-public-link-contract-test: PASS')
