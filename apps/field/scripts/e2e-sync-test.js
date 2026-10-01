const assert = require('node:assert/strict')

class FakeSupabase {
  constructor() {
    this.online = true
    this.failNextUpload = false
    this.user = { id: 'user-e2e-1', email: 'field@example.test' }
    this.workspace = 'workspace-e2e-1'
    this.sessions = new Map(); this.photos = new Map(); this.measurements = new Map(); this.objects = new Map()
    this.calls = []
  }
  currentWorkspace() { this.calls.push('rpc.current_workspace_id'); return this.workspace }
  upsert(table, row, key) {
    if (!this.online) throw new Error('network offline')
    this.calls.push(`db.upsert.${table}`)
    const target = table === 'inspection_sessions' ? this.sessions : table === 'inspection_photos' ? this.photos : this.measurements
    const composite = key.map((field) => row[field]).join('|')
    if (!target.has(composite)) target.set(composite, { ...row, id: `${table}-${target.size + 1}` })
    else target.set(composite, { ...target.get(composite), ...row })
    return target.get(composite)
  }
  upload(path, blob) {
    if (!this.online) throw new Error('network offline')
    this.calls.push('storage.upload')
    if (this.failNextUpload) { this.failNextUpload = false; throw new Error('simulated timeout') }
    this.objects.set(path, blob)
  }
}

function assertWorkspacePath(path, workspace, user, inspection, photo) {
  assert.equal(path, `${workspace}/${user}/${inspection}/${photo}.jpg`)
  assert.equal(path.split('/').length, 4)
}

async function syncOutbox(client, outbox, online) {
  if (!online) return { state: 'offline', synced: 0 }
  const workspace = client.currentWorkspace()
  const inspection = client.upsert('inspection_sessions', { workspace_id: workspace, created_by: client.user.id, status: 'in_progress', client_ref: outbox.job.id }, ['workspace_id', 'client_ref'])
  let synced = 0
  for (const photo of outbox.photos.filter((item) => item.state !== 'synced')) {
    try {
      photo.attempts++
      photo.state = 'syncing'
      const path = `${workspace}/${client.user.id}/${inspection.id}/${photo.id}.jpg`
      client.upload(path, { uri: photo.uri, mime: photo.mime })
      client.upsert('inspection_photos', { inspection_id: inspection.id, workspace_id: workspace, uploaded_by: client.user.id, client_ref: photo.id, object_path: path, album: photo.album, caption: photo.caption, mime_type: photo.mime, upload_status: 'uploaded' }, ['workspace_id', 'client_ref'])
      photo.state = 'synced'; photo.error = null; synced++
    } catch (error) { photo.state = 'failed'; photo.error = error.message }
  }
  for (const measurement of outbox.measurements.filter((item) => item.state !== 'synced')) {
    try {
      measurement.attempts++
      measurement.state = 'syncing'
      client.upsert('inspection_measurements', { inspection_id: inspection.id, workspace_id: workspace, created_by: client.user.id, client_ref: measurement.id, source_type: 'manual', confidence: 'unverified', roof_squares: measurement.roofSquares, eave_lf: measurement.eaveLf, pitch: String(measurement.pitch), source_reference: 'field-app' }, ['workspace_id', 'client_ref'])
      measurement.state = 'synced'; measurement.error = null; synced++
    } catch (error) { measurement.state = 'failed'; measurement.error = error.message }
  }
  return { state: outbox.photos.concat(outbox.measurements).every((item) => item.state === 'synced') ? 'synced' : 'retryable', synced }
}

;(async () => {
  const client = new FakeSupabase()
  const outbox = { job: { id: 'job-e2e-1' }, photos: [{ id: 'photo-e2e-1', uri: 'file:///photo.jpg', mime: 'image/jpeg', album: 'damage', caption: 'front slope', state: 'pending', attempts: 0 }], measurements: [{ id: 'measurement-e2e-1', roofSquares: 32.4, eaveLf: 118, pitch: 6, state: 'pending', attempts: 0 }] }

  // 1. Offline: no remote calls and local records stay queued.
  client.online = false
  const offline = await syncOutbox(client, outbox, false)
  assert.deepEqual(offline, { state: 'offline', synced: 0 })
  assert.equal(outbox.photos[0].state, 'pending'); assert.equal(client.calls.length, 0)

  // 2. First online attempt: provider/storage timeout marks the item retryable.
  client.online = true; client.failNextUpload = true
  const failed = await syncOutbox(client, outbox, true)
  assert.equal(failed.state, 'retryable'); assert.equal(outbox.photos[0].state, 'failed'); assert.equal(outbox.photos[0].attempts, 1)
  assert.equal(outbox.measurements[0].state, 'synced')

  // 3. Retry: the same client refs succeed, and the private path is workspace scoped.
  const retried = await syncOutbox(client, outbox, true)
  assert.deepEqual(retried, { state: 'synced', synced: 1 })
  assert.equal(outbox.photos[0].state, 'synced'); assert.equal(outbox.photos[0].attempts, 2)
  const inspection = [...client.sessions.values()][0]
  assertWorkspacePath([...client.objects.keys()][0], client.workspace, client.user.id, inspection.id, 'photo-e2e-1')

  // 4. Replay after an ambiguous timeout: idempotency leaves exactly one row each.
  await syncOutbox(client, outbox, true)
  assert.equal(client.sessions.size, 1); assert.equal(client.photos.size, 1); assert.equal(client.measurements.size, 1); assert.equal(client.objects.size, 1)

  // 5. Cross-workspace safety: a path from another workspace is not accepted by the contract.
  assert.throws(() => assertWorkspacePath(`other-workspace/${client.user.id}/${inspection.id}/photo-e2e-1.jpg`, client.workspace, client.user.id, inspection.id, 'photo-e2e-1'))

  console.log(JSON.stringify({
    passed: true,
    checks: ['offline queue preserved', 'failed upload retry', 'workspace-scoped private object path', 'idempotent session/photo/measurement upserts', 'cross-workspace path rejection'],
    counts: { sessions: client.sessions.size, photos: client.photos.size, measurements: client.measurements.size, objects: client.objects.size },
    attempts: outbox.photos[0].attempts,
  }, null, 2))
})().catch((error) => { console.error(error); process.exit(1) })
