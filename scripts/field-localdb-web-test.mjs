import assert from 'node:assert/strict'

const values = new Map()
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } })

const moduleUrl = new URL('../apps/field/src/localDb.web.ts', import.meta.url)
const first = await import(`${moduleUrl.href}?first-load`)
const draft = first.db.runSync(
  'INSERT INTO inspection_drafts',
  'user-a', 'workspace-a', 'client-draft-1', null, '15 Main Street', 0, 'draft', 40.1, -75.2, '2026-11-02T12:00:00.000Z',
)
const draftId = draft.lastInsertRowId
first.db.runSync(
  'INSERT INTO inspection_measurements_local',
  draftId, 'client-measurement-1', 24, 80, 40, 30, 6, 25, 30, 'asphalt', 40.1, -75.2, '2026-11-02T12:01:00.000Z',
)
const photo = first.db.runSync(
  'INSERT INTO inspection_photo_queue',
  draftId, 'client-photo-1', 'file:///photo.jpg', 'roof', 'Front slope', 'image/jpeg', 1024, 640, 480, '2026-11-02T12:02:00.000Z',
)
first.db.withTransactionSync(() => {
  first.db.runSync(
    'INSERT OR IGNORE INTO inspection_ai_request_queue (request_key, draft_id, photo_queue_id, feature_key, status, source_photo_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'ai-request-1', draftId, photo.lastInsertRowId, 'caption_album', 'waiting_for_upload', null,
    '2026-11-09T12:02:00.000Z', '2026-11-02T12:02:00.000Z', '2026-11-02T12:02:00.000Z',
  )
})
first.db.runSync(
  'UPDATE inspection_drafts SET technician_name = ?, technician_license = ?, verified_at = ?, verification_notes = ?, verification_synced = 0, updated_at = ? WHERE id = ?',
  'Field Tech', 'LIC-1', '2026-11-02T12:03:00.000Z', 'Reviewed in field', 0, '2026-11-02T12:03:00.000Z', draftId,
)
assert.ok(values.has('roofos.field.local-db.v1'), 'writes must persist a versioned snapshot')

const reloaded = await import(`${moduleUrl.href}?simulated-reload`)
const restoredDraft = reloaded.db.getFirstSync('SELECT * FROM inspection_drafts', 'user-a')
assert.equal(restoredDraft.address, '15 Main Street')
assert.equal(restoredDraft.id, draftId)
const appDrafts = reloaded.db.getAllSync(
  'SELECT id, remote_id as remoteId, owner_user_id as ownerUserId, workspace_id as workspaceId, client_id as clientId, lead_id as leadId, address, photo_count as photoCount, status, updated_at as updatedAt, latitude, longitude, technician_name as technicianName, technician_license as technicianLicense, verified_at as verifiedAt, verification_notes as verificationNotes, verification_synced as verificationSynced FROM inspection_drafts WHERE owner_user_id = ? ORDER BY updated_at DESC',
  'user-a',
)
assert.equal(appDrafts.length, 1, 'the app draft query must return saved drafts')
assert.equal(appDrafts[0].technicianName, 'Field Tech')
assert.equal(appDrafts[0].verificationNotes, 'Reviewed in field')
assert.equal(reloaded.db.getAllSync('SELECT id, remote_id as remoteId FROM inspection_drafts WHERE owner_user_id = ?', 'user-b').length, 0, 'drafts must not cross owner boundaries')
const restoredMeasurements = reloaded.db.getAllSync(
  'SELECT id, client_id, roof_squares, gutter_lf, eave_lf FROM inspection_measurements_local',
  draftId, 'queued', 'retry', '2026-11-02T13:00:00.000Z',
)
assert.equal(restoredMeasurements.length, 1)
assert.equal(restoredMeasurements[0].roof_squares, 24)
assert.equal(restoredMeasurements[0].client_id, 'client-measurement-1')
assert.equal(reloaded.db.getAllSync(
  'SELECT id, client_id, local_uri, album, caption, mime_type, file_size_bytes, width, height, captured_at FROM inspection_photo_queue WHERE draft_id = ? AND sync_status IN (?, ?) AND (next_retry_at IS NULL OR next_retry_at <= ?)',
  draftId, 'queued', 'retrying', '2026-11-02T13:00:00.000Z',
).length, 1, 'queued photo metadata must survive reload')
const aiQueueQuery = "SELECT id, local_uri, album, caption, sync_status, last_error, (SELECT status FROM inspection_ai_request_queue WHERE photo_queue_id = inspection_photo_queue.id AND feature_key = 'caption_album' LIMIT 1) AS caption_ai_status, (SELECT status FROM inspection_ai_request_queue WHERE photo_queue_id = inspection_photo_queue.id AND feature_key = 'photo_completeness' LIMIT 1) AS completeness_ai_status FROM inspection_photo_queue WHERE draft_id = ? ORDER BY captured_at DESC LIMIT 8"
assert.equal(reloaded.db.getAllSync(aiQueueQuery, draftId)[0].caption_ai_status, 'waiting_for_upload', 'request state must survive browser reload')
reloaded.db.runSync(
  'UPDATE inspection_ai_request_queue SET status = ?, source_photo_id = ?, updated_at = ? WHERE photo_queue_id = ? AND status = ?',
  'pending_analysis', 'remote-photo-1', '2026-11-02T13:01:00.000Z', photo.lastInsertRowId, 'waiting_for_upload',
)
assert.equal(reloaded.db.getAllSync(aiQueueQuery, draftId)[0].caption_ai_status, 'pending_analysis', 'confirmed upload must promote the AI request state')
assert.equal(reloaded.db.getAllSync('SELECT album FROM inspection_photo_queue WHERE draft_id = ?', draftId)[0].album, 'roof')
assert.throws(() => reloaded.db.withTransactionSync(() => {
  reloaded.db.runSync('DELETE FROM inspection_ai_request_queue WHERE feature_key = ?', 'caption_album')
  throw new Error('rollback')
}), /rollback/)
assert.equal(reloaded.db.getAllSync(aiQueueQuery, draftId)[0].caption_ai_status, 'pending_analysis', 'browser transaction must roll back a partial opt-out mutation')
reloaded.db.runSync('DELETE FROM inspection_ai_request_queue WHERE feature_key = ?', 'caption_album')
assert.equal(reloaded.db.getAllSync(aiQueueQuery, draftId)[0].caption_ai_status, null, 'opt-out must remove pending request metadata')
assert.equal(reloaded.db.getFirstSync('SELECT ((SELECT COUNT(*) ...)) AS n', draftId, draftId).n, 2)

console.log('field-localdb-web-test: PASS')
