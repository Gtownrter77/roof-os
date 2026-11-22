import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 53: a retry or a concurrent admin must not overwrite a terminal import state.
for (const [name, path] of [
  ['capout', '../app/api/claims/capout/route.ts'],
  ['local', '../app/api/claims/local/route.ts'],
]) {
  const source = read(path)
  const transitions = source.match(/\.eq\('status',\s*'received'\)/g) ?? []
  assert.ok(transitions.length >= 2, `${name} must guard both the success and failure status transitions`)
  assert.match(source, /if \(!updatedImport\)/, `${name} must detect a lost status race`)
  assert.match(source, /\{\s*status:\s*409/, `${name} must answer a lost race with 409`)
}

// 55: the signed URL is a URI, not document bytes. A URL hash must never be
// stored in source_sha256, and capout must seed a stable idempotency key.
for (const [name, path] of [
  ['capout', '../app/api/claims/capout/route.ts'],
  ['local', '../app/api/claims/local/route.ts'],
]) {
  const source = read(path)
  assert.doesNotMatch(source, /source_sha256:\s*sourceSha256/, `${name} must not label a URI hash as a content hash`)
  assert.match(source, /stableExternalDocumentId\(/, `${name} must derive a stable external document id`)
  assert.match(source, /sourceUriSha256/, `${name} must record the URI fingerprint under its honest name`)
}
const capout = read('../app/api/claims/capout/route.ts')
assert.match(capout, /external_document_id:\s*externalDocumentId/, 'capout must seed the idempotency key at insert')
const local = read('../app/api/claims/local/route.ts')
assert.match(local, /isContentSha256\([\s\S]{0,80}sourceSha256\)/, 'local must validate the worker byte hash')
assert.match(local, /source_sha256:\s*contentSha256/, 'local must persist the validated worker byte hash')

// Behavioral checks on the pure provenance helpers.
const { stableExternalDocumentId, isContentSha256, isRetryableImportStatus } = await import('../lib/claims/provenance.ts')
const path = '/storage/v1/object/sign/inspection-photos/claim/abc.pdf'
const urlA = `https://project.supabase.co${path}?token=ROTATING_A`
const urlB = `https://project.supabase.co${path}?token=ROTATING_B`
assert.equal(
  stableExternalDocumentId('capout', urlA),
  stableExternalDocumentId('capout', urlB),
  'rotating a signed URL token must not change the idempotency key'
)
assert.notEqual(
  stableExternalDocumentId('capout', urlA),
  stableExternalDocumentId('owner_import', urlA),
  'idempotency keys must be namespaced per provider'
)
assert.equal(stableExternalDocumentId('capout', 'https://evil.example/x'), null, 'non-storage URLs are rejected')
assert.equal(stableExternalDocumentId('capout', 'not a url'), null, 'malformed URLs are rejected')
assert.equal(isContentSha256('a'.repeat(64)), true, 'a 64-hex byte hash is accepted')
assert.equal(isContentSha256('short'), false, 'a short string is not a byte hash')
assert.equal(isContentSha256(urlA), false, 'a URL is not a byte hash')

// A transient failure must not permanently burn the stable idempotency key.
assert.equal(isRetryableImportStatus('failed'), true, 'a failed import may be retried')
assert.equal(isRetryableImportStatus('received'), true, 'an unfinished import may be retried')
for (const terminal of ['processing', 'ready_for_review', 'approved', 'rejected']) {
  assert.equal(isRetryableImportStatus(terminal), false, `${terminal} is not retryable`)
}
for (const [name, path] of [
  ['capout', '../app/api/claims/capout/route.ts'],
  ['local', '../app/api/claims/local/route.ts'],
]) {
  const source = read(path)
  assert.match(source, /isRetryableImportStatus\(/, `${name} must distinguish retryable from terminal import states`)
  assert.match(source, /\.eq\('external_document_id', externalDocumentId\)/, `${name} must look up an existing import by the stable key`)
  assert.match(source, /error_message:\s*null/, `${name} must clear a previous failure when reusing a row`)
  assert.match(source, /\.eq\('status',\s*existingImport\.status\)/, `${name} must guard the reset against a concurrent state change`)
  assert.match(source, /if \(!reused\)/, `${name} must detect a lost reset race`)
}
assert.match(capout, /providerDocumentId/, 'capout must retain the provider document id for correlation')

console.log('claims-provenance-test: PASS (status transitions guarded, provenance honest, ids stable)')
