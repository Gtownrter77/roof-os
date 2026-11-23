import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../apps/field/App.tsx', import.meta.url), 'utf8')

function photoQuery() {
  const match = source.match(/getAllSync<\{[^}]*\}>\('(SELECT id, client_id, local_uri[^']*FROM inspection_photo_queue[^']*)'/)
  assert.ok(match, 'the queued-photo SELECT must be findable')
  return match[1]
}

const query = photoQuery()
for (const column of ['hover_slot', 'blur_score', 'light_score']) {
  assert.ok(query.includes(column), `the queued-photo SELECT must read ${column}`)
}

const upsertStart = source.indexOf("from('inspection_photos').upsert(")
assert.ok(upsertStart >= 0, 'the inspection_photos upsert must exist')
const upsertEnd = source.indexOf('{ onConflict:', upsertStart)
assert.ok(upsertEnd > upsertStart, 'the upsert payload must be findable')
const upsert = source.slice(upsertStart, upsertEnd)
for (const column of ['hover_slot', 'blur_score', 'light_score']) {
  assert.match(upsert, new RegExp(`${column}: photo\\.${column}`), `the upsert payload must include ${column}`)
}
assert.ok(!upsert.includes('gps_in_file'), 'the client must never send an authoritative gps_in_file value')

const ingestCall = source.indexOf("'/api/hover/ingest'")
assert.ok(ingestCall >= 0, 'sync must call the Hover ingest route')
assert.ok(
  source.slice(ingestCall, ingestCall + 700).includes('inspectionDraftId: remoteId'),
  'the ingest call must identify the inspection draft',
)
assert.ok(
  upsertStart < ingestCall,
  'ingest must run after the photo upload/upsert loop',
)

console.log('PASS field upload sends Hover metadata without client GPS claims')
