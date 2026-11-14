import assert from 'node:assert/strict'
import { allowedFieldCorsOrigin, applyFieldCorsHeaders } from '../lib/field-cors.ts'

const previewOrigin = 'https://8328-ijv2gigo7sx9bhkos85ho-5ad4263d.us5.manus.computer'

assert.equal(allowedFieldCorsOrigin(previewOrigin), previewOrigin)
assert.equal(allowedFieldCorsOrigin('http://localhost:8081'), 'http://localhost:8081')
assert.equal(allowedFieldCorsOrigin('https://evil.example'), null)
assert.equal(
  allowedFieldCorsOrigin('https://field.example.com', { ROOF_OS_FIELD_CORS_ORIGINS: 'https://field.example.com' }),
  'https://field.example.com',
)

const headers = applyFieldCorsHeaders(new Headers(), previewOrigin)
assert.equal(headers.get('Access-Control-Allow-Origin'), previewOrigin)
assert.equal(headers.get('Access-Control-Allow-Credentials'), 'true')
assert.match(headers.get('Access-Control-Allow-Headers') ?? '', /Idempotency-Key/)
assert.notEqual(headers.get('Access-Control-Allow-Origin'), '*')

console.log('field-cors-test: passed')
