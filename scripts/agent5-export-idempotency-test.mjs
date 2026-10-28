import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseStructuredLines } from '../lib/agent5/parser.ts'
import { buildReviewPacket } from '../lib/agent5/reviewer.ts'
import {
  REVIEW_CSV_COLUMNS,
  REVIEW_EXPORT_SCHEMA,
  buildReviewExport,
  buildReviewExportFile,
  toReviewCsv,
  toReviewJson,
} from '../lib/agent5/export.ts'
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  canonicalJson,
  fingerprintRequest,
  fingerprintsMatch,
  normalizeIdempotencyKey,
} from '../lib/agent5/idempotency.ts'
import { classifyPersistenceError, retryDelaySeconds } from '../lib/agent5/retry.ts'
import {
  CAPOUT_UNSUPPORTED,
  buildCapoutCandidate,
  capoutAdapterStatus,
} from '../lib/agent5/capout-adapter.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const carrier = parseStructuredLines([
  { item_code: 'M1', description: 'Shingles, "architectural"', category: 'material', quantity: 10, unit: 'SQ', unit_cost: 100 },
  { item_code: 'A1', description: 'Optional ridge upgrade', category: 'material', quantity: 1, unit: 'EA', unit_cost: 250, enabled: 'no' },
  { item_code: 'P1', description: 'Paid when incurred tarp', quantity: 1, unit: 'EA', paid_when_incurred: 'true' },
], 'fixture-doc')
const contractor = parseStructuredLines([
  { item_code: 'M1', description: 'Shingles, "architectural"', category: 'material', quantity: 12, unit: 'SQ', unit_cost: 100 },
], 'contractor-fixture')
const packet = buildReviewPacket({ documentId: 'fixture-doc', carrier, contractor, measurements: ['roof 12 SQ'] })
assert.equal(packet.status, 'ready_for_review')
assert.ok(packet.proposals.some((proposal) => proposal.kind === 'quantity_delta'))

// 1. JSON export is deterministic and labelled review-only.
const json = toReviewJson(packet)
assert.equal(json, toReviewJson(packet), 'same packet produces the same JSON bytes')
assert.ok(json.endsWith('\n'))
const parsed = JSON.parse(json)
assert.equal(parsed.schema, REVIEW_EXPORT_SCHEMA)
assert.equal(parsed.document_id, 'fixture-doc')
assert.equal(parsed.packet_status, 'ready_for_review')
assert.equal(parsed.boundaries.generated_for, 'human_review')
assert.equal(parsed.boundaries.external_submission, false)
assert.equal(parsed.boundaries.insurer_submission, false)
assert.equal(parsed.boundaries.esx_compatible, false)
assert.equal(parsed.boundaries.export_blocked, true)
assert.equal(parsed.lines.length, packet.lines.length)
assert.deepEqual(parsed.totals, packet.totals)
const unpriced = parsed.lines.find((line) => line.item_code === 'P1')
assert.equal(unpriced.unit_cost, null, 'a missing price stays null in JSON')
assert.equal(unpriced.line_total, null)
assert.ok(!json.includes('$0.00'), 'a missing price is never rendered as $0.00')

// 2. CSV export has a stable header, one row per line, one per proposal, and RFC4180 quoting.
const csv = toReviewCsv(packet)
assert.equal(csv, toReviewCsv(packet), 'same packet produces the same CSV bytes')
assert.ok(csv.endsWith('\n'))
const rows = csv.trimEnd().split('\n')
assert.equal(rows[0], REVIEW_CSV_COLUMNS.join(','))
assert.equal(rows.length, 1 + packet.lines.length + packet.proposals.length)
assert.ok(rows.some((row) => row.startsWith('line,M1,"Shingles, ""architectural"""')), 'commas and quotes are escaped')
const lineRows = rows.filter((row) => row.startsWith('line,'))
assert.equal(lineRows.length, packet.lines.length)
const proposalRows = rows.filter((row) => row.startsWith('proposal,'))
assert.equal(proposalRows.length, packet.proposals.length)
assert.ok(!csv.includes('$0.00'), 'CSV never invents a price')

// 3. Export file metadata is bounded and internal.
const jsonFile = buildReviewExportFile(packet, 'json')
assert.equal(jsonFile.filename, 'fixture-doc-review.json')
assert.equal(jsonFile.content_type, 'application/json;charset=utf-8')
assert.equal(jsonFile.content, json)
const csvFile = buildReviewExportFile(packet, 'csv')
assert.equal(csvFile.filename, 'fixture-doc-review.csv')
assert.equal(csvFile.content_type, 'text/csv;charset=utf-8')
const unsafe = buildReviewExportFile({ ...packet, document_id: '../../etc/passwd' }, 'json')
assert.ok(!unsafe.filename.includes('/'), 'document id cannot escape the filename')
assert.ok(!unsafe.filename.includes('..'), 'document id cannot traverse')
assert.deepEqual(buildReviewExport(packet).boundaries, parsed.boundaries)

// 4. Idempotency key validation.
assert.deepEqual(normalizeIdempotencyKey(null), { key: null, error: null })
assert.deepEqual(normalizeIdempotencyKey('   '), { key: null, error: 'Idempotency-Key must not be empty.' })
assert.ok(normalizeIdempotencyKey('short').error, 'short keys are rejected')
assert.ok(normalizeIdempotencyKey('x'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1)).error, 'overlong keys are rejected')
assert.ok(normalizeIdempotencyKey('bad key with spaces 0001').error, 'unsupported characters are rejected')
const goodKey = normalizeIdempotencyKey('  retry-2026-11-15:aaaa.0001  ')
assert.equal(goodKey.error, null)
assert.equal(goodKey.key, 'retry-2026-11-15:aaaa.0001')

// 5. Fingerprints are order-independent and payload-sensitive.
const payload = {
  document_id: 'fixture-doc',
  carrier_rows: [{ description: 'A', quantity: 1 }, { description: 'B', quantity: 2 }],
  contractor_rows: [],
  measurements: ['roof 12 SQ'],
  previous_draft_id: null,
}
const reordered = {
  contractor_rows: [],
  previous_draft_id: null,
  measurements: ['roof 12 SQ'],
  carrier_rows: [{ quantity: 1, description: 'A' }, { quantity: 2, description: 'B' }],
  document_id: 'fixture-doc',
}
assert.equal(fingerprintRequest(payload), fingerprintRequest(reordered), 'key order does not change the fingerprint')
assert.equal(fingerprintRequest(payload).length, 64)
assert.ok(fingerprintsMatch(fingerprintRequest(payload), fingerprintRequest(reordered)))
assert.ok(!fingerprintsMatch(fingerprintRequest(payload), fingerprintRequest({ ...payload, measurements: ['roof 13 SQ'] })))
assert.ok(!fingerprintsMatch(fingerprintRequest(payload), null))
assert.equal(canonicalJson({ b: 2, a: [undefined, 1] }), '{"a":[null,1],"b":2}')

// 6. Retry policy: only transient database errors are retryable.
assert.equal(classifyPersistenceError('40001').retryable, true)
assert.equal(classifyPersistenceError('40P01').retryable, true)
assert.equal(classifyPersistenceError('53300').retryable, true)
assert.equal(classifyPersistenceError('57P03').retryable, true)
assert.equal(classifyPersistenceError('23505').retryable, false, 'unique violations are handled as replay, not retried')
assert.equal(classifyPersistenceError('42501').retryable, false)
assert.equal(classifyPersistenceError(undefined).retryable, false)
assert.equal(classifyPersistenceError(null).retryable, false)
assert.deepEqual(
  [0, 1, 2, 3, 4, 20].map(retryDelaySeconds),
  [1, 2, 4, 8, 8, 8],
)

// 7. CapOut stays disabled by default and never submits or claims ESX parity.
const disabled = capoutAdapterStatus({})
assert.equal(disabled.enabled, false)
assert.equal(disabled.requested, false)
assert.equal(disabled.reason, 'disabled_by_default')
assert.equal(disabled.submission_allowed, false)
assert.equal(disabled.esx_compatible, false)
assert.equal(disabled.external_submission, false)

const flagOnly = capoutAdapterStatus({ AGENT5_CAPOUT_ADAPTER: 'enabled' })
assert.equal(flagOnly.enabled, false, 'a flag without configuration is not enabled')
assert.equal(flagOnly.reason, 'enabled_but_endpoint_missing')

const configured = capoutAdapterStatus({
  AGENT5_CAPOUT_ADAPTER: 'enabled',
  CAPOUT_API_BASE_URL: 'https://example.invalid',
  CAPOUT_API_KEY: 'validation-only',
})
assert.equal(configured.enabled, true)
assert.equal(configured.submission_allowed, false, 'submission is still off when the adapter is enabled')
assert.equal(configured.esx_compatible, false)
assert.equal(configured.external_submission, false)
for (const item of ['esx_generation', 'insurer_submission', 'pricing_lookup']) {
  assert.ok(configured.unsupported.includes(item), `unsupported list names ${item}`)
}
assert.deepEqual(configured.unsupported, CAPOUT_UNSUPPORTED)

const candidate = buildCapoutCandidate(packet, configured)
assert.equal(candidate.submission_allowed, false)
assert.equal(candidate.esx_compatible, false)
assert.equal(candidate.external_submission, false)
assert.equal(candidate.lines.length, packet.lines.length)
assert.deepEqual(candidate.lines.find((line) => line.item_code === 'A1'), {
  item_code: 'A1',
  description: 'Optional ridge upgrade',
  quantity: 1,
  unit: 'EA',
  unit_cost: 250,
  enabled: false,
})
assert.equal(candidate.lines.find((line) => line.item_code === 'P1').unit_cost, null)

// 8. Source contracts: no network in the new modules; the route wires the guard.
for (const [name, source] of [
  ['export', read('../lib/agent5/export.ts')],
  ['idempotency', read('../lib/agent5/idempotency.ts')],
  ['retry', read('../lib/agent5/retry.ts')],
  ['capout-adapter', read('../lib/agent5/capout-adapter.ts')],
]) {
  assert.ok(!/fetch\(|axios|XMLHttpRequest|https?:\/\//i.test(source), `${name} performs no outbound call`)
}
assert.ok(!/capout|\.esx\b/i.test(read('../lib/agent5/export.ts')), 'the review export never claims CapOut or ESX')

const route = read('../app/api/supplements/review/route.ts')
assert.ok(route.includes("request.headers.get('idempotency-key')"), 'the route reads the idempotency header')
assert.ok(route.includes('fingerprintRequest'), 'the route fingerprints the request')
assert.ok(route.includes('idempotency_key: idempotency.key'))
assert.ok(route.includes("code === '23505'"), 'unique violations are handled explicitly')
assert.ok(route.includes('idempotency_conflict'), 'a changed payload with a used key is a conflict')
assert.ok(route.includes('idempotent_replay: true'))
assert.ok(route.includes('classifyPersistenceError'))
assert.ok(route.includes("'Retry-After': String(retry.retry_after_seconds ?? 1)"))
assert.ok(!/fetch\(|axios|https?:\/\//i.test(route), 'the route performs no outbound call')

// 9. Migration 066 is additive, per-workspace, and bounded.
const migration = read('../supabase/migrations/066_supplement_review_idempotency.sql')
assert.ok(migration.includes('add column if not exists idempotency_key text'))
assert.ok(migration.includes('request_fingerprint'))
assert.ok(migration.includes('unique index if not exists supplement_review_drafts_idempotency_idx'))
assert.ok(migration.includes('(workspace_id, idempotency_key)'))
assert.ok(migration.includes('char_length(idempotency_key) between 16 and 128'))
assert.ok(!/for delete|drop policy|drop table/i.test(migration), 'the migration adds no delete or policy removal')
const verify = read('../scripts/ci/verify-supplement-specialist-postgres.sh')
assert.ok(verify.includes('066_supplement_review_idempotency.sql'))
const assertions = read('../scripts/ci/supplement-specialist-assertions.sql')
assert.ok(assertions.includes('duplicate idempotency key accepted'), 'real PostgreSQL asserts key reuse is rejected')
assert.ok(assertions.includes('idempotency key did not stay scoped per workspace'))

// 10. UI offers an internal review copy and still has no insurer path.
const page = read('../app/supplement/review/page.tsx')
assert.ok(page.includes('buildReviewExportFile'))
assert.ok(page.includes('Download review JSON'))
assert.ok(page.includes('Download review CSV'))
assert.ok(page.includes('Internal review copy only'))
assert.ok(!/fetch\(`?'?[^`'\")]*capout|\.esx\b|mailto:|sendgrid|twilio/i.test(page))

// 11. CI wiring.
const pkg = JSON.parse(read('../package.json'))
assert.equal(pkg.scripts['test:agent5-export-idempotency'], 'node --experimental-strip-types --no-warnings scripts/agent5-export-idempotency-test.mjs')
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:agent5-export-idempotency'))

console.log('agent5-export-idempotency-test: PASS (deterministic JSON/CSV, no invented price, no ESX claim, key scoping, replay-conflict source contract, retry policy, CapOut disabled by default, migration 066, CI wiring)')
