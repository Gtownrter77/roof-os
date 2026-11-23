import assert from 'node:assert/strict'
import { buildReportPackage, parseReportPayload } from '../lib/hover/report.ts'
import { RULES_VERSION } from '../lib/hover/measurements.ts'

const evidence = [{ imageId: 'img-1', region: null, planeId: 'p1', modelVersion: 'recon-1' }]
const record = (id, type, value, unit, facetId) => ({
  id, setId: 'set-1', type, value, unit, confidence: 0.85,
  sourceRefs: evidence, status: 'accepted', ...(facetId ? { facetId } : {}),
})
const set = {
  id: 'set-1', jobId: 'job-1', workspaceId: 'ws-1', reconstructionId: 'recon-1',
  rulesetVersion: RULES_VERSION, status: 'locked',
  records: [
    record('r1', 'facet_area', 111.8, 'sqft', 'f1'),
    record('r2', 'facet_pitch', 26.565, 'deg', 'f1'),
    record('r3', 'pitch_adjusted_squares', 1.23, 'squares'),
    record('r4', 'soffit_area', 12.5, 'sqft', 'soffit-1'),
    record('r5', 'siding_area', 200, 'sqft', 'wall-1'),
    record('r6', 'gutter_lf', 40, 'lf'),
    record('r7', 'downspout_count', 2, 'count'),
    record('r8', 'opening', null, 'Unknown'),
  ],
  confidenceSummary: { min: 0.85, mean: 0.85, count: 8 },
  lockedBy: 'u-owner', lockedAt: '2026-11-23T01:00:00.000Z', createdAt: '2026-11-23T00:00:00.000Z',
}
const manifest = {
  jobId: 'job-1', workspaceId: 'ws-1', manifestHash: 'a'.repeat(64),
  createdAt: '2026-11-23T00:00:00.000Z',
  images: [
    { id: 'img-1', slot: 'front', role: 'model', storagePath: 'photos/1.jpg' },
    { id: 'img-2', slot: 'right', role: 'model', storagePath: 'photos/2.jpg' },
  ],
  anchors: [],
}
const graph = {
  sourceReconstructionId: 'recon-1',
  facets: [{ id: 'f1', material: 'shingle', role: 'roof', vertices: [], normal: { x: 0, y: 0, z: 1 }, planeId: 'p1', evidenceImageIds: ['img-1'] }],
  edges: [], openings: [], gutters: [], soffits: [],
}
const input = { set, manifest, graph, deliverable: 'roof_only', modelUrl: 'https://example.test/model/recon-1' }

const pkg = buildReportPackage(input)
assert.deepEqual(pkg.map((item) => item.format), ['PDF', 'XLS', 'XML', 'JSON'])
for (const item of pkg) {
  assert.match(item.contentHash, /^[a-f0-9]{64}$/)
  assert.equal(item.rulesetVersion, RULES_VERSION)
  assert.doesNotMatch(item.content, /\$|USD|dollars?/i, `no dollar amounts in ${item.format}`)
}
const byFormat = Object.fromEntries(pkg.map((item) => [item.format, item]))
for (const section of ['model_link', 'photo_gallery', 'measurement_glossary', 'roof_summary',
  'facet_table', 'pitch_adjusted_squares', 'waste_factor_table', 'soffit']) {
  assert.ok(byFormat.JSON.sections.includes(section), `missing section ${section}`)
}
for (const section of ['siding_summary', 'elevations', 'facade_details', 'openings', 'gutters', 'downspout_count']) {
  assert.equal(byFormat.JSON.sections.includes(section), false, 'roof_only must not include full-exterior sections')
}
assert.match(byFormat.PDF.content, /%PDF-1\.4/)
assert.match(byFormat.PDF.content, /recon-1/)
assert.match(byFormat.XLS.content, /facet_area/)
assert.match(byFormat.PDF.content, /Unknown/)
assert.match(byFormat.XLS.content, /Unknown/)
assert.doesNotMatch(byFormat.PDF.content, /null/i)

const jsonPayload = parseReportPayload(byFormat.JSON.content, 'JSON')
const xmlPayload = parseReportPayload(byFormat.XML.content, 'XML')
assert.deepEqual(jsonPayload.set, set)
assert.deepEqual(xmlPayload.set, set)
assert.deepEqual(jsonPayload, xmlPayload, 'JSON and XML must round-trip to the same payload')

const full = buildReportPackage({ ...input, deliverable: 'full_exterior' })
const fullJson = full.find((item) => item.format === 'JSON')
for (const section of ['siding_summary', 'elevations', 'facade_details', 'openings', 'gutters', 'downspout_count']) {
  assert.ok(fullJson.sections.includes(section), `full_exterior missing ${section}`)
}

const again = buildReportPackage(input)
assert.deepEqual(again.map((item) => item.contentHash), pkg.map((item) => item.contentHash), 'serialization must be deterministic')

console.log('hover-report-test: PASS')
