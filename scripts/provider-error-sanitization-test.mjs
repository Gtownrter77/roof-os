import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clientSafeProviderError } from '../lib/provider-error-safety.ts'

// 64: provider error bodies may echo credentials, hosts, or signed URLs. Only a
// fixed, bounded message may cross the API boundary.
const SECRET = 'sk_live_supersecret_provider_body_echo'
for (const kind of ['lowes-token', 'lowes-search']) {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    const message = clientSafeProviderError(kind, status)
    assert.ok(typeof message === 'string' && message.length > 0 && message.length < 200, 'client message must be a bounded string')
    assert.ok(!message.includes(SECRET), 'client message must not embed provider body content')
    assert.ok(!/\d{3,}/.test(message.replace(/Lowe's/g, '')), 'client message must not embed a raw HTTP body dump')
  }
}
assert.notEqual(clientSafeProviderError('lowes-token', 401), clientSafeProviderError('lowes-token', 503), 'credential rejection must differ from outage')
assert.ok(!clientSafeProviderError('lowes-token', 401).includes('client_secret'), 'client message must not name credential parameters')

const lowes = readFileSync(new URL('../lib/lowes.ts', import.meta.url), 'utf8')
assert.ok(lowes.includes("from './provider-error-safety'"), 'lowes must import the sanitizer')
assert.ok(lowes.includes('clientSafeProviderError('), 'lowes must return a sanitized error')
assert.ok(!/provider: payload/.test(lowes), 'raw token payload must not be returned to callers')

const route = readFileSync(new URL('../app/api/pricing/lowes/route.ts', import.meta.url), 'utf8')
assert.ok(route.includes('clientSafeProviderError('), 'pricing route must return a sanitized provider error')
assert.ok(!/provider: oauth\.provider/.test(route), 'raw OAuth provider body must not reach the client')
assert.ok(!/error: 'Lowe\\'s pricing provider failed\.', provider: result/.test(route), 'raw search provider body must not reach the client')

console.log('provider-error-sanitization-test: PASS (raw provider bodies stay server-side)')
