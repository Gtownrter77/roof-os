import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const proxy = readFileSync('proxy.ts', 'utf8')
const app = readFileSync('apps/field/App.tsx', 'utf8')
const check = (pattern, label) => assert.ok(pattern.test(proxy), label)

// Field web builds POST JSON + Authorization to these endpoints, so the
// browser issues a non-simple CORS preflight. Without an OPTIONS response and
// ACAO headers, GPS verification/report sync fails forever and never certifies.
check(/function isFieldCorsPath\(pathname: string\)/, 'proxy must define one field-CORS path predicate')
for (const route of ['/api/supplements/review', '/api/photo-provenance/verify', '/api/photo-to-report']) {
  check(
    new RegExp(`pathname === '${route.replace(/\//g, '\\/')}'`),
    `field-CORS path predicate must include ${route}`,
  )
}
check(
  /if \(isFieldCorsPath\(pathname\) && request\.method === 'OPTIONS'\)/,
  'proxy must answer OPTIONS preflight for every field-CORS path',
)
check(
  /if \(isFieldCorsPath\(pathname\)\) \{\s*\n\s*applyFieldCorsHeaders/,
  'proxy must apply field CORS to final responses for every field-CORS path',
)
assert.ok(!/isSupplementReviewPath\(/.test(proxy), 'old single-endpoint helper must be replaced')

for (const route of ['/api/photo-provenance/verify', '/api/photo-to-report']) {
  assert.ok(app.includes(`'content-type': 'application/json', authorization: 'Bearer '`), `field must send token to ${route}`)
  assert.ok(app.includes(route), `field must call ${route}`)
}

console.log('field-preflight-contract-test: PASS (preflight + CORS cover all field token endpoints)')
