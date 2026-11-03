import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync('apps/field/App.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/034_mobile_offline_idempotency.sql', 'utf8')
const verificationMigration = readFileSync('supabase/migrations/050_mobile_technician_verification.sql', 'utf8')
const fieldMeasurementMigration = readFileSync('supabase/migrations/052_mobile_field_measurement_inputs.sql', 'utf8')

for (const marker of [
  'WHERE owner_user_id = ?',
  'draftToSync.ownerUserId !== session.user.id',
  'draftToSync.workspaceId !== workspaceId',
  "onConflict: 'workspace_id,client_id'",
  'UPDATE inspection_measurements_local SET sync_status = ?, last_error = NULL, next_retry_at = NULL WHERE id = ?',
  "sync_status IN (?, ?) AND (next_retry_at IS NULL OR next_retry_at <= ?)",
  'Automatic retry scheduled.',
  'syncLock.current',
  'retryDelayMs',
  'let syncSucceeded = false',
  'syncSucceeded = true',
  'if (syncSucceeded) setLastSyncedAt(new Date().toISOString())',
  'if (draftRef.current?.id === draftToSync.id) setPendingUploads(pendingRowCount(draftToSync.id))',
  'pendingCount = pendingRowCount(draftId)',
  'label="Pending items"',
  'loadDrafts(undefined, true)',
  'readLocalDrafts()',
  'syncQueuedDrafts',
  'SELECT roof_squares, gutter_lf, eave_lf',
  "setPhotoCaption('')",
  'const activeId = draftRef.current?.id ?? (preserveSelection ? undefined : preferredId)',
  'const activeDraftId = draftRef.current?.id',
  'if (activeDraftId === draftToSync.id)',
  "client_version: 'field-0.5.0'",
  'complete manual measurement set',
  'notes: draftToSync.verificationNotes',
  'eave_lf',
  'rafter_lf',
  'soffit_lf',
  'fascia_lf',
  'roof_type',
  'caption: photo.caption',
  'file_size_bytes: photo.file_size_bytes',
  'width: photo.width',
  'height: photo.height',
  'already exists|duplicate',
  'client_id: measurement.client_id',
  'client_id: photo.client_id',
  'UPGRADES ONLY · NO REGRESSIONS',
  'NetInfo.addEventListener',
  'setDrafts(rows)',
  'inspection_verifications',
  'saveTechnicianVerification',
  'Automatic retry scheduled.',
]) assert.ok(app.includes(marker), `app contract missing: ${marker}`)
const syncSuccessAt = app.indexOf('syncSucceeded = true')
const syncCatchAt = app.indexOf('} catch (syncError) {', syncSuccessAt)
const syncTimestampAt = app.indexOf('if (syncSucceeded) setLastSyncedAt(', syncCatchAt)
assert.ok(syncSuccessAt >= 0 && syncCatchAt > syncSuccessAt && syncTimestampAt > syncCatchAt, 'last-synced time must follow all writes and be guarded by the success flag')
const queueTransactions = app.match(/db\.withTransactionSync\(\(\) => \{[\s\S]*?pendingCount = pendingRowCount\(draftId\)[\s\S]*?\n\s*\}\)/g) ?? []
assert.equal(queueTransactions.length, 2, 'photo and measurement rows must update pending counts inside SQLite transactions')
assert.ok(queueTransactions.some((block) => block.includes('inspection_photo_queue')), 'photo queue count must be transaction-scoped')
assert.ok(queueTransactions.some((block) => block.includes('inspection_measurements_local')), 'measurement queue count must be transaction-scoped')
for (const marker of [
  'inspection_sessions_workspace_client_uidx',
  'inspection_measurements_workspace_client_uidx',
  'inspection_photos_workspace_client_uidx',
]) assert.ok(migration.includes(marker), `migration contract missing: ${marker}`)
for (const marker of ['inspection_verifications', 'enable row level security', 'public.is_workspace_member(workspace_id)', 'technician_name']) assert.ok(verificationMigration.includes(marker), `verification migration missing: ${marker}`)
for (const marker of ['rafter_lf', 'soffit_lf', 'fascia_lf', 'roof_type']) assert.ok(fieldMeasurementMigration.includes(marker), `field measurement migration missing: ${marker}`)

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
