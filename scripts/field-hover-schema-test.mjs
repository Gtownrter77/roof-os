import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The web adapter must round-trip the same Hover capture metadata as native SQLite.
const values = new Map()
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } })

const moduleUrl = new URL('../apps/field/src/localDb.web.ts', import.meta.url)
const { db } = await import(`${moduleUrl.href}?hover-schema`)

const draft = db.runSync(
  'INSERT INTO inspection_drafts',
  'user-hover', 'workspace-hover', 'client-hover-1', null, '9 Roof Lane', 0, 'draft', 40.2, -75.3, '2026-11-23T10:00:00.000Z',
)
const draftId = draft.lastInsertRowId

// A front model photo: album 'model', embedded GPS stamp succeeded, unscored.
db.runSync(
  'INSERT INTO inspection_photo_queue',
  draftId, 'client-photo-hover-1', 'file:///front.jpg', 'model', 'Front', 'image/jpeg', 2048, 640, 480, '2026-11-23T10:01:00.000Z',
  'front', 1, 0.82, 0.61, null, null,
)

const hoverRows = db.getAllSync(
  'SELECT id, hover_slot, gps_verified, blur_score, light_score, superseded_at, superseded_reason FROM inspection_photo_queue WHERE draft_id = ?',
  draftId,
)
assert.equal(hoverRows.length, 1, 'the web adapter must keep Hover photo metadata queryable')
assert.equal(hoverRows[0].hover_slot, 'front', 'the selected slot must survive the local queue')
assert.equal(hoverRows[0].gps_verified, 1, 'a successful on-device stamp must be recorded')
assert.equal(hoverRows[0].blur_score, 0.82, 'blur score must round-trip')
assert.equal(hoverRows[0].light_score, 0.61, 'light score must round-trip')
assert.equal(hoverRows[0].superseded_at, null, 'a fresh capture must not be superseded')

// A photo whose GPS stamp failed must never be marked verified by default.
db.runSync(
  'INSERT INTO inspection_photo_queue',
  draftId, 'client-photo-hover-2', 'file:///rear.jpg', 'model', 'Rear', 'image/jpeg', 2048, 640, 480, '2026-11-23T10:02:00.000Z',
  'rear', null, null, null, null, null,
)
const defaultRows = db.getAllSync(
  'SELECT id, gps_verified FROM inspection_photo_queue WHERE draft_id = ?',
  draftId,
)
assert.equal(defaultRows.length, 2, 'both queued photos must be queryable')
assert.equal(defaultRows[1].gps_verified, 0, 'missing GPS verification must default to 0, never an implicit pass')

// Reference anchors are draft-level and idempotent by client id.
db.runSync(
  'INSERT INTO inspection_hover_anchors',
  draftId, 'anchor-door-1', 'door', 80, 'in', '2026-11-23T10:03:00.000Z',
)
db.runSync(
  'INSERT OR IGNORE INTO inspection_hover_anchors',
  draftId, 'anchor-door-1', 'door', 80, 'in', '2026-11-23T10:03:00.000Z',
)
const anchors = db.getAllSync(
  'SELECT client_id, draft_id, kind, observed_value, unit FROM inspection_hover_anchors WHERE draft_id = ?',
  draftId,
)
assert.equal(anchors.length, 1, 'anchor retries must be idempotent')
assert.equal(anchors[0].kind, 'door')
assert.equal(anchors[0].observed_value, 80)
assert.equal(anchors[0].unit, 'in')

// Native SQLite gets the same columns through the existing additive migration path.
const appSource = readFileSync(new URL('../apps/field/App.tsx', import.meta.url), 'utf8')
for (const column of [
  'hover_slot TEXT',
  'gps_verified INTEGER NOT NULL DEFAULT 0',
  'blur_score REAL',
  'light_score REAL',
  'superseded_at TEXT',
  'superseded_reason TEXT',
]) {
  assert.ok(
    appSource.includes(`ALTER TABLE inspection_photo_queue ADD COLUMN ${column}`),
    `native queue migration must add ${column}`,
  )
}
assert.ok(
  appSource.includes('CREATE TABLE IF NOT EXISTS inspection_hover_anchors'),
  'native queue must create the local anchor table',
)
assert.ok(
  !appSource.includes('ALTER TABLE inspection_photo_queue ADD COLUMN gps_in_file'),
  'the local GPS flag must be named gps_verified, not a server-authoritative gps_in_file',
)

console.log('PASS field hover local schema (native + web adapter)')
