import assert from 'node:assert/strict'
import { ensureLocalColumns } from '../apps/field/src/localMigrations.ts'

const existing = {
  inspection_drafts: new Set(['id', 'owner_user_id', 'workspace_id']),
  inspection_measurements_local: new Set(['id', 'roof_squares']),
  inspection_photo_queue: new Set(['id', 'local_uri']),
}
const executed = []
const reads = []
const database = {
  getAllSync(sql) {
    reads.push(sql)
    const match = sql.match(/^PRAGMA table_info\((inspection_drafts|inspection_measurements_local|inspection_photo_queue)\)$/)
    assert.ok(match, `unexpected schema query: ${sql}`)
    return [...(existing[match[1]] ?? [])].map((name) => ({ name }))
  },
  execSync(sql) {
    executed.push(sql)
    const match = sql.match(/^ALTER TABLE (inspection_drafts|inspection_measurements_local|inspection_photo_queue) ADD COLUMN ([a-z_]+)/i)
    assert.ok(match, `unexpected migration statement: ${sql}`)
    existing[match[1]].add(match[2])
  },
}

ensureLocalColumns(database, [
  'ALTER TABLE inspection_drafts ADD COLUMN owner_user_id TEXT',
  'ALTER TABLE inspection_drafts ADD COLUMN client_id TEXT',
  'ALTER TABLE inspection_measurements_local ADD COLUMN roof_squares REAL',
  'ALTER TABLE inspection_photo_queue ADD COLUMN local_uri TEXT',
  'ALTER TABLE inspection_photo_queue ADD COLUMN caption TEXT',
])

assert.deepEqual(executed, [
  'ALTER TABLE inspection_drafts ADD COLUMN client_id TEXT',
  'ALTER TABLE inspection_measurements_local ADD COLUMN roof_squares REAL',
  'ALTER TABLE inspection_photo_queue ADD COLUMN caption TEXT',
])
assert.equal(reads.length, 3, 'read each table schema once')
assert.ok(existing.inspection_drafts.has('client_id'))
assert.ok(existing.inspection_photo_queue.has('caption'))

const brokenDb = {
  getAllSync: () => [],
  execSync: () => { throw new Error('disk I/O error') },
}
assert.throws(
  () => ensureLocalColumns(brokenDb, ['ALTER TABLE inspection_drafts ADD COLUMN client_id TEXT']),
  /disk I\/O error/,
  'real SQLite errors must propagate instead of being mistaken for an existing column',
)
assert.throws(
  () => ensureLocalColumns(database, ['ALTER TABLE users ADD COLUMN is_admin INTEGER']),
  /Unsupported local schema migration/,
  'only known local tables may be altered',
)

console.log('mobile-local-db-migration-test: PASS')
