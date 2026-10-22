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
console.log('live-release-preflight-test: PASS')
