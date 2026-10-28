import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Break-glass gate is dependency-free, so it can be exercised directly.
const { assertOwnerEnterAuthorized } = await import('../lib/auth/owner-enter-gate.ts')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const prevSecret = process.env.OWNER_ENTER_SECRET
function withSecret(value, fn) {
  if (value === undefined) delete process.env.OWNER_ENTER_SECRET
  else process.env.OWNER_ENTER_SECRET = value
  try {
    return fn()
  } finally {
    if (prevSecret === undefined) delete process.env.OWNER_ENTER_SECRET
    else process.env.OWNER_ENTER_SECRET = prevSecret
  }
}

// 1. Unset secret: locked, never open.
withSecret(undefined, () => {
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: 'anything-long-enough' }), { ok: false, reason: 'enter_locked' })
})

// 2. Empty / whitespace-only secret: locked.
for (const value of ['', '   ', '\t\n']) {
  withSecret(value, () => {
    assert.equal(assertOwnerEnterAuthorized({ providedKey: value.trim() }).ok, false, 'blank secret must lock')
    assert.equal(assertOwnerEnterAuthorized({ providedKey: value.trim() }).reason, 'enter_locked')
  })
}

// 3. Short secret (<16 chars): locked even when the request matches exactly.
for (const value of ['a', 'short', 'fifteen-chars!!']) {
  assert.ok(value.length < 16)
  withSecret(value, () => {
    const result = assertOwnerEnterAuthorized({ providedKey: value })
    assert.equal(result.ok, false, 'short secret must never unlock')
    assert.equal(result.reason, 'enter_locked')
  })
}

// 4. Sixteen characters is the minimum accepted length.
withSecret('0123456789abcdef', () => {
  assert.equal(assertOwnerEnterAuthorized({ providedKey: '0123456789abcdef' }).ok, true)
})

// 5. Wrong length and wrong value are both forbidden, not locked.
withSecret('sixteen-chars-min', () => {
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: 'sixteen-chars-mi' }), { ok: false, reason: 'enter_forbidden' })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: 'sixteen-chars-minX' }), { ok: false, reason: 'enter_forbidden' })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: 'wrong-key-value!!!!' }), { ok: false, reason: 'enter_forbidden' })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: '' }), { ok: false, reason: 'enter_forbidden' })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: null }), { ok: false, reason: 'enter_forbidden' })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: '   ' }), { ok: false, reason: 'enter_forbidden' })
})

// 6. Matching value succeeds; surrounding whitespace is trimmed on both sides.
withSecret('sixteen-chars-min', () => {
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: 'sixteen-chars-min' }), { ok: true })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: '  sixteen-chars-min  ' }), { ok: true })
  assert.deepEqual(assertOwnerEnterAuthorized({ providedKey: 'sixteen-chars-min\n' }), { ok: true })
})

// 7. Gate is case-sensitive and rejects near matches.
withSecret('Sixteen-Chars-Min', () => {
  assert.equal(assertOwnerEnterAuthorized({ providedKey: 'sixteen-chars-min' }).ok, false)
  assert.equal(assertOwnerEnterAuthorized({ providedKey: 'Sixteen-Chars-Min' }).ok, true)
})

// 8. Route contract: query key and header key, gate before session mint, no-store.
const route = read('../app/auth/enter/route.ts')
assert.ok(route.includes("url.searchParams.get('key')"), 'query key is supported')
assert.ok(route.includes("request.headers.get('x-roof-os-enter')"), 'header key is supported')
assert.ok(route.indexOf('assertOwnerEnterAuthorized') < route.indexOf('establishOwnerSession'), 'gate runs before session mint')
assert.ok(route.includes('enter_error'), 'failure reason is surfaced to login')
assert.ok(route.includes('Cache-Control\': \'no-store') || route.includes("'Cache-Control', 'no-store"), 'redirects are not cached')
assert.ok(/httpOnly: true/.test(route) && /secure: true/.test(route), 'skip-enter cookie is httpOnly and secure')
assert.ok(!/OWNER_ENTER_SECRET\s*\)?\s*[=:]/.test(route), 'route never assigns the secret')

// 9. Session minting never creates or invites users, and fails closed.
const ownerEnter = read('../lib/auth/owner-enter.ts')
assert.ok(!/createUser|inviteUserByEmail|signUp/.test(ownerEnter), 'break glass must not create or invite users')
assert.ok(ownerEnter.includes('enter_misconfigured'), 'unconfigured environment fails closed')
assert.ok(!/listUsers|admin\.auth\.admin\.getUser\s*\(\s*\)/.test(ownerEnter), 'never enumerates Auth users')
assert.ok(/Fail closed[^\n]*\n\s*return null/.test(ownerEnter), 'owner resolution fails closed')
assert.ok(ownerEnter.includes('SUPABASE_SERVICE_ROLE_KEY'), 'service role only used for admin mint')

// 10. Login page renders typed break-glass errors instead of silently succeeding.
const login = read('../app/auth/login/page.tsx')
assert.ok(login.includes('enter_error'), 'login reads enter_error')
assert.ok(login.includes('ERROR_COPY'), 'login maps failure reasons to messages')

console.log('owner-break-glass-test: PASS (locked on missing/short secret, forbidden on wrong key, case-sensitive match, header+query paths, gate before mint, no user creation, fail-closed owner resolution)')
