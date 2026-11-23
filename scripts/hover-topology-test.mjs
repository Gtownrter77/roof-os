import assert from 'node:assert/strict'
import { fitPlane, polygonArea, pitchFromNormal } from '../lib/hover/geometry.ts'
import { buildFacetGraph } from '../lib/hover/topology.ts'

const flat = [
  { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
  { x: 10, y: 10, z: 0 }, { x: 0, y: 10, z: 0 },
]
const plane = fitPlane(flat)
assert.ok(plane)
assert.ok(Math.abs(Math.abs(plane.normal.z) - 1) < 1e-9)
assert.equal(polygonArea(flat), 100)

const degenerate = fitPlane([flat[0], flat[0], flat[1]])
assert.equal(degenerate, null)
assert.equal(polygonArea([flat[0], flat[1]]), 0)

const slope = [
  { x: 0, y: 0, z: 0 }, { x: 12, y: 0, z: 6 }, { x: 12, y: 10, z: 6 }, { x: 0, y: 10, z: 0 },
]
const slopePlane = fitPlane(slope)
assert.ok(Math.abs(pitchFromNormal(slopePlane.normal) - 26.56505117707799) < 1e-6)

const reconstruction = { id: 'recon-1', jobId: 'job-1', manifestHash: 'a'.repeat(64) }
const transform = { scale: 1, metricStatus: 'metric', manifestHash: 'a'.repeat(64) }

const left = {
  id: 'f-left', planeId: 'p-left', role: 'roof', material: null,
  vertices: [
    { x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: 0 },
    { x: 5, y: 10, z: 3 }, { x: 5, y: 0, z: 3 },
  ],
  normal: { x: 0, y: 0, z: 1 }, evidenceImageIds: ['img-0'],
}
const right = {
  id: 'f-right', planeId: 'p-right', role: 'roof', material: null,
  vertices: [
    { x: 5, y: 0, z: 3 }, { x: 5, y: 10, z: 3 },
    { x: 10, y: 10, z: 0 }, { x: 10, y: 0, z: 0 },
  ],
  normal: { x: 0, y: 0, z: 1 }, evidenceImageIds: ['img-1'],
}
const soffit = {
  id: 'f-soffit', planeId: 'p-soffit', role: 'soffit', material: null,
  vertices: [
    { x: 0, y: 0, z: -0.5 }, { x: 0, y: 10, z: -0.5 },
    { x: 0.5, y: 10, z: -0.5 }, { x: 0.5, y: 0, z: -0.5 },
  ],
  normal: { x: 0, y: 0, z: -1 }, evidenceImageIds: ['img-2'],
}
const noEvidence = { ...left, id: 'f-no-evidence', evidenceImageIds: [] }

const graph = buildFacetGraph(reconstruction, transform, {
  facets: [left, right, soffit, noEvidence],
  semanticsAvailable: true,
  openings: [{ id: 'o1', type: 'door', width: 3, height: 6.7, evidenceImageIds: ['img-3'] }],
  gutters: [{ id: 'g1', length: 20, downspoutCount: 2, evidenceImageIds: ['img-4'] }],
})
assert.equal(graph.facets.length, 3, 'facet without evidence must be rejected')
assert.equal(graph.soffits.length, 1)
assert.deepEqual(graph.soffits.map((facet) => facet.id), ['f-soffit'])
assert.ok(graph.edges.some((edge) => edge.type === 'ridge' && Math.abs(edge.length - 10) < 1e-6))
assert.ok(graph.edges.some((edge) => edge.type === 'eave'))
assert.equal(graph.openings[0].type, 'door')
assert.equal(graph.gutters[0].downspoutCount, 2)

const unknown = buildFacetGraph(reconstruction, transform, { facets: [left], semanticsAvailable: false })
assert.equal(unknown.openings[0].type, 'unknown')
assert.equal(unknown.openings[0].width, null)
assert.equal(unknown.gutters[0].length, null)
assert.equal(unknown.gutters[0].downspoutCount, null)

const relative = buildFacetGraph(reconstruction, { ...transform, scale: null, metricStatus: 'relative-only' }, { facets: [left, right] })
assert.ok(relative.edges.every((edge) => Number.isFinite(edge.length)))

console.log('hover-topology-test: PASS')
