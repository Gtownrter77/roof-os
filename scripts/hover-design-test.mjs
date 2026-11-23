import assert from 'node:assert/strict'
import { applyDesign, designDiff } from '../lib/hover/design.ts'

const facet = (id, material) => ({
  id, planeId: `p-${id}`, role: 'roof', material,
  vertices: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 10, z: 0 }],
  normal: { x: 0, y: 0, z: 1 }, evidenceImageIds: ['img-1'],
})
const graph = {
  sourceReconstructionId: 'recon-1', facets: [facet('f1', 'tile'), facet('f2', 'tile')],
  soffits: [], edges: [], openings: [], gutters: [],
}
const set = {
  id: 'set-1', status: 'locked',
  records: [
    {
      id: 'r1', setId: 'set-1', type: 'facet_area', value: 100, unit: 'sqft', confidence: 0.9,
      sourceRefs: [{ imageId: 'img-1', region: null, planeId: 'p-f1', modelVersion: 'recon-1' }],
      status: 'accepted', facetId: 'f1',
    },
    {
      id: 'r2', setId: 'set-1', type: 'facet_area', value: 200, unit: 'sqft', confidence: 0.9,
      sourceRefs: [{ imageId: 'img-1', region: null, planeId: 'p-f2', modelVersion: 'recon-1' }],
      status: 'accepted', facetId: 'f2',
    },
  ],
}
const base = { set, graph, jobId: 'job-1', facetGraphRef: 'recon-1:v1', roofStyle: 'gable' }
const selection = { facetId: 'f1', material: 'shingle', color: 'charcoal', product: 'Shingle A' }

const before = applyDesign({ ...base, selections: [], mode: '2d-photo' })
const after = applyDesign({ ...base, selections: [selection], mode: '2d-photo' })
assert.equal(after.facets.find((f) => f.id === 'f1').material, 'shingle')
assert.equal(after.facets.find((f) => f.id === 'f2').material, 'tile')
const diff = designDiff(before, after)
assert.equal(diff.length, 1)
assert.deepEqual(diff[0], {
  facetId: 'f1', field: 'material', before: 'tile', after: 'shingle',
})
assert.deepEqual(designDiff(after, applyDesign({ ...base, selections: [selection], mode: '2d-photo' })), [])

const q1 = after.quantities.find((q) => q.facetId === 'f1')
const q2 = after.quantities.find((q) => q.facetId === 'f2')
assert.equal(q1.wasteFactor, 0.1)
assert.equal(q1.quantitySqFt, 110)
assert.equal(q2.wasteFactor, 0.15)
assert.equal(q2.quantitySqFt, 230)
const replay = applyDesign({ ...base, selections: [selection], mode: '2d-photo' })
assert.equal(replay.hash, after.hash, 'design hash must be deterministic')

const styleChanged = applyDesign({ ...base, selections: [selection], facetGraphRef: 'recon-1:v2', mode: '3d-twin' })
assert.ok(designDiff(after, styleChanged).some((entry) => entry.field === 'facetGraphRef'))

const photo = applyDesign({ ...base, selections: [selection], mode: '2d-photo' })
const twin = applyDesign({ ...base, selections: [selection], mode: '3d-twin' })
assert.deepEqual(Object.keys(photo.selections[0]).sort(), Object.keys(twin.selections[0]).sort())
assert.equal(photo.mode, '2d-photo')
assert.equal(twin.mode, '3d-twin')

assert.doesNotMatch(JSON.stringify(after), /\$|USD|"price"|dollars?/i)
assert.match(after.hash, /^[a-f0-9]{64}$/)

console.log('hover-design-test: PASS')
