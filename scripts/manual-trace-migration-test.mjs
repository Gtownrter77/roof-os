import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migrationUrl = new URL('../supabase/migrations/113_manual_traced_measurements.sql', import.meta.url)

// 113 is forward-only: it widens the existing source_type check on
// inspection_measurements and owns no new columns or tables.
assert.ok(existsSync(migrationUrl), 'migration 113_manual_traced_measurements.sql must exist')
const migration = readFileSync(migrationUrl, 'utf8')

assert.match(
  migration,
  /alter\s+table\s+(?:public\.)?inspection_measurements\s+drop\s+constraint\s+if\s+exists\s+inspection_measurements_source_type_check\s*;/i,
  'migration 113 must drop the existing inspection_measurements_source_type_check',
)
const check = migration.match(
  /add\s+constraint\s+inspection_measurements_source_type_check\s+check\s*\(\s*source_type\s+in\s*\(([^)]*)\)\s*\)/i,
)
assert.ok(check, 'migration 113 must re-add inspection_measurements_source_type_check on source_type')
assert.deepEqual(
  [...check[1].matchAll(/'([^']+)'/g)].map((match) => match[1]),
  ['manual', 'device_gps', 'aerial_provider', 'photo_inference', 'ai_formulated', 'manual_traced'],
  'source_type check must keep all five existing values and add manual_traced',
)
assert.ok(!/create\s+table/i.test(migration), 'migration 113 must not create any table')
assert.match(
  migration,
  /comment\s+on\s+column\s+(?:public\.)?inspection_measurements\.source_type\s+is\s+'/i,
  'migration 113 must document the widened source_type column',
)

// The ordered filesystem ledger and governed release metadata must advance together.
const migrations = readdirSync(new URL('../supabase/migrations', import.meta.url))
  .filter((name) => name.endsWith('.sql'))
  .sort()
assert.equal(migrations.at(-1), '114_jarvis_adjuster.sql', 'migration head must be 114')
assert.equal(migrations.length, 112, 'migration count must be 112')
const governed = [
  ['README.md', /114_jarvis_adjuster\.sql/, /112 migration files/],
  ['DEPLOYMENT.md', /114_jarvis_adjuster\.sql/, /112 migration files/],
  ['.github/workflows/ci.yml', /test -f supabase\/migrations\/114_jarvis_adjuster\.sql/, null],
  ['scripts/release-foreman-check.mjs', /114_jarvis_adjuster\.sql/, /112/],
  ['scripts/field-hover-migration-test.mjs', /114_jarvis_adjuster\\?\.sql/, /112 migration files/],
]
for (const [file, headPattern, countPattern] of governed) {
  const source = read('../' + file)
  assert.match(source, headPattern, `${file} must name the current migration head`)
  if (countPattern) assert.match(source, countPattern, `${file} must state the new migration count`)
}

// Advancing the head must not erase the prior migration's column contract.
assert.match(read('../.github/workflows/ci.yml'), /test -f supabase\/migrations\/112_inspection_photos_hover_fields\.sql/, 'CI must keep the 112 existence check')
const fieldHover = read('../scripts/field-hover-migration-test.mjs')
assert.match(fieldHover, /112_inspection_photos_hover_fields\.sql/, 'field-hover test must keep reading migration 112 for its column assertions')
for (const column of ['hover_slot', 'blur_score', 'light_score']) {
  assert.ok(fieldHover.includes(column), `field-hover test must keep the ${column} column assertion`)
}

console.log('manual-trace-migration-test: PASS (migration 113 contract, six source types, governed head 114/112)')
