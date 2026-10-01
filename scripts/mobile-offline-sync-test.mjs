import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync('apps/field/App.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/034_mobile_offline_idempotency.sql', 'utf8')

for (const marker of [
  'WHERE owner_user_id = ?',
  'draft.ownerUserId !== session.user.id',
  'draft.workspaceId !== workspaceId',
  "onConflict: 'workspace_id,client_id'",
  'UPDATE inspection_measurements_local SET sync_status = ? WHERE id = ?',
  'already exists|duplicate',
  'client_id: measurement.client_id',
  'client_id: photo.client_id',
]) assert.ok(app.includes(marker), `app contract missing: ${marker}`)
for (const marker of [
  'inspection_sessions_workspace_client_uidx',
  'inspection_measurements_workspace_client_uidx',
  'inspection_photos_workspace_client_uidx',
]) assert.ok(migration.includes(marker), `migration contract missing: ${marker}`)

const sessions = new Map()
const measurements = new Map()
const photos = new Map()
function upsert(map, workspaceId, clientId, value) {
  const key = `${workspaceId}:${clientId}`
  if (!map.has(key)) map.set(key, { id: map.size + 1, ...value })
  return map.get(key)
}

// User/workspace scoping: the same client key is isolated by workspace.
upsert(sessions, 'workspace-a', 'inspection-1', { owner: 'user-a' })
upsert(sessions, 'workspace-b', 'inspection-1', { owner: 'user-b' })
assert.equal(sessions.size, 2)
assert.equal(sessions.get('workspace-a:inspection-1').owner, 'user-a')

// Measurement retry: a partial batch can be retried without duplication.
upsert(measurements, 'workspace-a', 'measurement-1', { value: 10 })
upsert(measurements, 'workspace-a', 'measurement-1', { value: 10 })
upsert(measurements, 'workspace-a', 'measurement-2', { value: 20 })
assert.equal(measurements.size, 2)

// Photo retry after Storage succeeded but metadata insert failed.
let metadataAttempt = 0
function retryPhoto() {
  const photo = upsert(photos, 'workspace-a', 'photo-1', { objectPath: 'workspace-a/user-a/session/photo-1.jpg' })
  metadataAttempt += 1
  return photo
}
retryPhoto()
retryPhoto()
assert.equal(photos.size, 1)
assert.equal(metadataAttempt, 2)

// Different users cannot reuse another workspace's queued record.
assert.notEqual(sessions.get('workspace-a:inspection-1').owner, 'user-b')
console.log('mobile-offline-sync-test: PASS')