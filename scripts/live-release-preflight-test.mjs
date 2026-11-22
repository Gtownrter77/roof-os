import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const preflight = readFileSync('scripts/live-release-preflight.mjs', 'utf8')
const owner = readFileSync('OWNER-MANUAL.md', 'utf8')
assert.ok(preflight.includes('NEXT_PUBLIC_SUPABASE_URL'))
assert.ok(preflight.includes('SUPABASE_SERVICE_ROLE_KEY'))
assert.ok(preflight.includes('publicSecretPattern'))
assert.ok(preflight.includes('External gates still unknown'))
assert.ok(preflight.includes('No network request'))
assert.ok(!/fetch\s*\(|https?:\/\//.test(preflight), 'preflight must not call network endpoints')
assert.ok(owner.includes('repository hygiene only'))
assert.ok(owner.includes('production verification'))

// 52: the preflight must not claim it checked env presence when it did not.
assert.ok(preflight.includes('validateRequiredNames'), 'env presence must be a callable, testable check')
assert.ok(!preflight.includes('Checked required variable names'), 'must not claim unchecked names were checked')
assert.match(preflight, /UNVERIFIED/, 'env presence must be labeled UNVERIFIED unless explicitly enforced')

const { validateRequiredNames, requiredNames } = await import('./live-release-preflight.mjs')
assert.deepEqual(validateRequiredNames({}), requiredNames, 'an empty env must report every required name missing')
assert.deepEqual(
  validateRequiredNames(Object.fromEntries(requiredNames.map((name) => [name, 'x']))),
  [],
  'a complete env must report no missing names'
)
assert.deepEqual(
  validateRequiredNames({ NEXT_PUBLIC_SUPABASE_URL: '   ' }),
  requiredNames,
  'whitespace-only values count as missing'
)
assert.deepEqual(
  validateRequiredNames({ NEXT_PUBLIC_SUPABASE_URL: 'x' }),
  requiredNames.filter((name) => name !== 'NEXT_PUBLIC_SUPABASE_URL'),
  'a present value is not reported missing'
)
console.log('live-release-preflight-test: PASS')
