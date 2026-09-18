import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/
function safeNextPath(value, origin) {
  if (!value) return '/'
  let decoded
  try { decoded = decodeURIComponent(value) } catch { return '/' }
  if (CONTROL_CHARACTERS.test(decoded) || decoded.includes('\\')) return '/'
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/'
  try {
    const resolved = new URL(decoded, origin)
    if (resolved.origin !== origin || resolved.pathname.startsWith('//')) return '/'
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return '/'
  }
}

const origin = 'https://roof-os.example'
for (const [candidate, expected] of [
  ['/leads?status=open#top', '/leads?status=open#top'],
  ['//evil.example/path', '/'],
  ['/\\evil.example/path', '/'],
  ['/%5C%5Cevil.example/path', '/'],
  ['https://evil.example/', '/'],
  ['/safe\u0000path', '/'],
  ['not-a-path', '/'],
]) assert.equal(safeNextPath(candidate, origin), expected, candidate)

const callback = readFileSync('app/auth/callback/route.ts', 'utf8')
const capout = readFileSync('app/api/claims/capout/route.ts', 'utf8')
const supplements = readFileSync('app/api/supplements/route.ts', 'utf8')
const supplementMigration = readFileSync('supabase/migrations/026_supplement_review_admin_guard.sql', 'utf8')
const fieldApp = readFileSync('apps/field/App.tsx', 'utf8')
const photoVerify = readFileSync('app/api/photo-estimate/verify/route.ts', 'utf8')
const photoGuard = readFileSync('supabase/migrations/027_photo_estimate_admin_guard.sql', 'utf8')
const runtime = readFileSync('workers/agent-runtime.ts', 'utf8')
assert.ok(callback.includes("safeNextPath(url.searchParams.get('next'), url.origin)"))
assert.ok(capout.includes("Workspace administrator access is required."))
assert.ok(capout.includes("isAuthorizedStorageUrl(body.sourceUrl)"))
assert.ok(capout.indexOf("from('workspace_members')") < capout.indexOf('fetch(`${CAPOUT_API}/upload`'))
assert.ok(capout.indexOf("from('claims_imports').insert") < capout.indexOf('fetch(`${CAPOUT_API}/upload`'))
assert.ok(supplements.includes("rpc('is_workspace_admin'"))
assert.ok(supplements.includes('Workspace administrator access is required'))
assert.ok(supplementMigration.includes("role in ('owner', 'admin')"))
assert.ok(fieldApp.includes('const draftId = saveDraft()'))
assert.ok(fieldApp.includes('INSERT INTO inspection_measurements_local'))
assert.ok(fieldApp.includes('client_id, roof_squares, gutter_lf'))
assert.ok(fieldApp.includes('inspection_photo_queue'))
assert.ok(photoVerify.includes("rpc('is_workspace_admin'"))
assert.ok(photoVerify.includes('Measurement values are outside supported safety limits.'))
assert.ok(photoGuard.includes('public.is_workspace_admin(workspace_id)'))
assert.ok(runtime.includes(".eq('status', existing.status)"))
assert.ok(runtime.includes("error.code !== '23505'"))
console.log('security-check: PASS')
