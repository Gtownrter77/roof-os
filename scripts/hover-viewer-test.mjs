import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildViewerModel, viewerCannotMeasure } from '../lib/hover/viewer.ts'

const facet = {
  id: 'f1', planeId: 'p1', role: 'roof', material: 'shingle',
  vertices: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 10, z: 0 }],
  normal: { x: 0, y: 0, z: 1 }, evidenceImageIds: ['img-1'],
}
const graph = {
  sourceReconstructionId: 'recon-1', facets: [facet], soffits: [], edges: [],
  openings: [], gutters: [],
}
const set = {
  id: 'set-1', status: 'locked',
  records: [
    {
      id: 'm1', setId: 'set-1', type: 'facet_area', value: 100, unit: 'sqft', confidence: 0.9,
      sourceRefs: [{ imageId: 'img-1', region: null, planeId: 'p1', modelVersion: 'recon-1' }],
      status: 'accepted', facetId: 'f1',
    },
    {
      id: 'm2', setId: 'set-1', type: 'opening', value: null, unit: 'Unknown', confidence: 0.5,
      sourceRefs: [{ imageId: 'img-2', region: null, planeId: null, modelVersion: 'recon-1' }],
      status: 'accepted',
    },
  ],
}
const manifest = { jobId: 'job-1', manifestHash: 'a'.repeat(64) }

const model = buildViewerModel({ graph, set, manifest, splatUrl: 'https://example.test/splat/recon-1' })
assert.equal(model.facets.length, 1)
assert.equal(model.splatUrl, 'https://example.test/splat/recon-1')
assert.equal(model.measurementSource, 'measurement-records')
assert.equal(model.overlays.length, 2)
for (const overlay of model.overlays) {
  assert.ok('evidenceImageId' in overlay, 'overlay must expose a clickable evidence image id')
  assert.ok(overlay.evidenceLinks.length > 0)
  assert.equal(overlay.evidenceLinks[0].href, `/photos/${overlay.evidenceImageId}`)
}
const unknown = model.overlays.find((item) => item.measurementId === 'm2')
assert.equal(unknown.value, null)
assert.match(unknown.label, /Unknown/)

assert.equal(viewerCannotMeasure, true)
const viewerSource = readFileSync('lib/hover/viewer.ts', 'utf8')
const componentSource = readFileSync('components/hover/MeasurementViewer.tsx', 'utf8')
for (const source of [viewerSource, componentSource]) {
  assert.doesNotMatch(source, /measure[A-Za-z]*FromSplat|splat[A-Za-z]*Dimension|getDimensionFrom/i,
    'the viewer must not expose a dimension derived from splat pixels')
}

const relative = buildViewerModel({
  graph, set: { ...set, records: [] }, manifest,
  splatUrl: 'https://example.test/splat/recon-1',
})
assert.equal(relative.facets.length, 1, 'relative-only jobs still render the visual twin')
assert.equal(relative.overlays.length, 0, 'relative-only jobs show no measurement overlay')

console.log('hover-viewer-test: PASS')
