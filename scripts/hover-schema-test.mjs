import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const migrationPath = 'supabase/migrations/111_hover_scan_pipeline.sql'
assert.equal(existsSync(migrationPath), true, 'missing new hover migration 111')
const sql = readFileSync(migrationPath, 'utf8')

const existing = readFileSync('supabase/migrations/110_release_job_safety_hold.sql', 'utf8')
assert.ok(existing.length > 0)
assert.ok('111' > '110')

const tables = [
  'scan_jobs', 'scan_images', 'scale_anchors', 'reconstructions',
  'measurement_sets', 'measurements', 'evidence_links', 'qa_events', 'export_artifacts',
]
for (const table of tables) {
  assert.match(sql, new RegExp(`create table[\\s\\S]*?\\b${table}\\b`, 'i'), `missing table ${table}`)
  assert.match(sql, new RegExp(`alter table\\s+(public\\.)?${table}\\s+enable row level security`, 'i'), `RLS not enabled on ${table}`)
  assert.match(sql, new RegExp(`create policy[\\s\\S]*?on\\s+(public\\.)?${table}\\b`, 'i'), `missing policy on ${table}`)
}
for (const column of ['workspace_id', 'created_at']) {
  assert.equal((sql.match(new RegExp(column, 'g')) || []).length >= tables.length, true, `${column} missing on tables`)
}
assert.match(sql, /gps_in_file\s+boolean/i)
assert.match(sql, /metric_status/i)
assert.match(sql, /ruleset_version/i)
assert.match(sql, /correction_of/i)
assert.doesNotMatch(sql, /drop table|alter table[\s\S]*?rename/i)

const typesPath = 'lib/hover/types.ts'
assert.equal(existsSync(typesPath), true, 'missing canonical hover types')
const source = readFileSync(typesPath, 'utf8')
for (const symbol of [
  'ScanJob', 'ScanImage', 'ScaleAnchor', 'MetricTransform', 'MeasurementRecord',
  'MeasurementSet', 'EvidenceLink', 'QAEvent', 'ExportArtifact', 'CAPTURE_SLOTS', 'SLA_TIERS',
]) {
  assert.match(source, new RegExp(`export (type|const|interface) ${symbol}\\b`), `types.ts must export ${symbol}`)
}

const { hashBytes, roundTo, finite, uuid, now } = await import('../lib/hover/util.ts')
assert.equal(hashBytes(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
assert.equal(roundTo(1.23456, 2), 1.23)
assert.equal(finite(3), 3)
assert.throws(() => finite(Number.NaN))
assert.match(uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
assert.ok(!Number.isNaN(Date.parse(now())))

const { CAPTURE_SLOTS, SLA_TIERS } = await import('../lib/hover/types.ts')
assert.equal(CAPTURE_SLOTS.length, 8)
assert.deepEqual(CAPTURE_SLOTS.map((slot) => slot.id), [
  'front', 'front_right', 'right', 'rear_right', 'rear', 'rear_left', 'left', 'front_left',
])
assert.deepEqual(SLA_TIERS.map((tier) => tier.id), ['visual-twin', 'estimated', 'verified', 'certified'])

console.log('hover-schema-test: PASS')
