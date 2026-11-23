import assert from 'node:assert/strict'
import { EXPORT_FORMATS, gatedFormats, generateExport } from '../lib/hover/exports.ts'
import { RULES_VERSION } from '../lib/hover/measurements.ts'

assert.deepEqual([...EXPORT_FORMATS], ['PDF', 'XLS', 'XML', 'JSON', 'ESX', 'SKP', 'DWG', 'DXF'])
assert.deepEqual([...gatedFormats], ['ESX', 'SKP', 'DWG'])

const set = {
  id: 'set-1', jobId: 'job-1', workspaceId: 'ws-1', reconstructionId: 'recon-1',
  rulesetVersion: RULES_VERSION, status: 'locked',
  records: [{
    id: 'r1', setId: 'set-1', type: 'facet_area', value: 100, unit: 'sqft', confidence: 0.9,
    sourceRefs: [{ imageId: 'img-1', region: null, planeId: 'p1', modelVersion: 'recon-1' }],
    status: 'accepted', facetId: 'f1',
  }],
  confidenceSummary: { min: 0.9, mean: 0.9, count: 1 },
  lockedBy: 'u-owner', lockedAt: '2026-11-23T01:00:00.000Z', createdAt: '2026-11-23T00:00:00.000Z',
}
const graph = {
  sourceReconstructionId: 'recon-1', facets: [], soffits: [], openings: [], gutters: [],
  edges: [
    { id: 'e1', type: 'ridge', start: { x: 0, y: 0, z: 5 }, end: { x: 10, y: 0, z: 5 }, length: 10, evidenceImageIds: ['img-1'] },
    { id: 'e2', type: 'eave', start: { x: 0, y: 10, z: 0 }, end: { x: 10, y: 10, z: 0 }, length: 10, evidenceImageIds: ['img-1'] },
  ],
}
const manifest = {
  jobId: 'job-1', workspaceId: 'ws-1', manifestHash: 'a'.repeat(64),
  createdAt: '2026-11-23T00:00:00.000Z', images: [], anchors: [],
}
const base = { set, graph, manifest }

const dxf = generateExport({ ...base, format: 'DXF' })
assert.equal(dxf.status, 'ok')
assert.match(dxf.content, /^0\nSECTION/)
assert.match(dxf.content, /AC1009/)
assert.equal((dxf.content.match(/\nLINE\n/g) || []).length, 2)
assert.match(dxf.content, /HOVER_RIDGE/)
assert.match(dxf.content, /10\.0/)
assert.equal(dxf.rulesetVersion, RULES_VERSION)
assert.match(dxf.contentHash, /^[a-f0-9]{64}$/)

for (const format of gatedFormats) {
  const blocked = generateExport({ ...base, format })
  assert.equal(blocked.status, 'blocked', `${format} must be blocked without owner approval`)
  assert.match(blocked.reason || '', /approval|owner/i)
  assert.equal(blocked.rulesetVersion, RULES_VERSION)
  assert.match(blocked.contentHash, /^[a-f0-9]{64}$/)

  const unsupported = generateExport({ ...base, format, ownerApproval: 'approval-token' })
  assert.equal(unsupported.status, 'unsupported', `${format} must not fabricate a binary`)
  assert.match(unsupported.reason || '', /converter|approved|not configured/i)

  const approved = generateExport({
    ...base, format, ownerApproval: 'approval-token',
    converter: ({ format: target }) => `licensed ${target} payload for ${set.id}`,
  })
  assert.equal(approved.status, 'ok')
  assert.equal(approved.rulesetVersion, RULES_VERSION)
  assert.match(approved.contentHash, /^[a-f0-9]{64}$/)
}

for (const format of ['PDF', 'XLS', 'XML', 'JSON']) {
  const result = generateExport({ ...base, format })
  assert.equal(result.status, 'ok')
  assert.ok(result.content.length > 0)
  assert.equal(result.rulesetVersion, RULES_VERSION)
  assert.match(result.contentHash, /^[a-f0-9]{64}$/)
}

const replay = generateExport({ ...base, format: 'DXF' })
assert.equal(replay.contentHash, dxf.contentHash, 'DXF serialization must be deterministic')

console.log('hover-exports-test: PASS')
