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
assert.ok(callback.includes("safeNextPath(url.searchParams.get('next'), url.origin)"))
assert.ok(capout.includes("Workspace administrator access is required."))
assert.ok(capout.includes("isAuthorizedStorageUrl(body.sourceUrl)"))
assert.ok(capout.indexOf("from('workspace_members')") < capout.indexOf('fetch(`${CAPOUT_API}/upload`'))
assert.ok(capout.indexOf("from('claims_imports').insert") < capout.indexOf('fetch(`${CAPOUT_API}/upload`'))
console.log('security-check: PASS')
