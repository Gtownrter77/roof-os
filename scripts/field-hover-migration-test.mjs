import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Migration 112 is forward-only and adds ONLY three metadata columns to the
// existing inspection_photos table. It must never create a new Hover table.
const migrationPath = new URL('../supabase/migrations/112_inspection_photos_hover_fields.sql', import.meta.url)
const migration = readFileSync(migrationPath, 'utf8')

const alterStatements = [...migration.matchAll(/alter\s+table\s+(?:public\.)?inspection_photos\s+add\s+column\s+([a-z_]+)\s+([a-z ]+?)(?:\s*;|,|$)/gi)]
  .map((match) => `${match[1]} ${match[2].trim().toLowerCase()}`)
assert.deepEqual(alterStatements.sort(), [
  'blur_score double precision',
  'hover_slot text',
  'light_score double precision',
], 'migration 112 must add exactly hover_slot, blur_score and light_score')

assert.ok(
  !/create\s+table/gi.test(migration),
  'migration 112 must not create any table (no new Hover tables beyond 111)',
)
assert.ok(!/scan_jobs|scan_images|scale_anchors/gi.test(migration), 'migration 112 must not redefine Hover pipeline tables')

const governed = [
  ['README.md', /114_jarvis_adjuster\.sql/, /112 migration files/],
  ['DEPLOYMENT.md', /114_jarvis_adjuster\.sql/, /112 migration files/],
  ['.github/workflows/ci.yml', /test -f supabase\/migrations\/114_jarvis_adjuster\.sql/, null],
  ['scripts/release-foreman-check.mjs', /114_jarvis_adjuster\.sql/, /112/],
]
for (const [file, headPattern, countPattern] of governed) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  assert.match(source, headPattern, `${file} must name the current migration head`)
  if (countPattern) assert.match(source, countPattern, `${file} must state the new migration count`)
}

console.log('PASS migration 112 and governed release metadata')
