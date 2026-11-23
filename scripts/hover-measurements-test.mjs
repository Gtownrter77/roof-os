import assert from 'node:assert/strict'
import {
  RULES_VERSION, deriveMeasurements, pitchAdjustedSquares, wasteTable,
} from '../lib/hover/measurements.ts'
import { fitPlane } from '../lib/hover/geometry.ts'

const slope = [
  { x: 0, y: 0, z: 0 }, { x: 12, y: 0, z: 6 },
  { x: 12, y: 10, z: 6 }, { x: 0, y: 10, z: 0 },
]
const facet = {
  id: 'f1', planeId: 'p1', role: 'roof', material: 'shingle',
  vertices: slope, normal: fitPlane(slope).normal, evidenceImageIds: ['img-1'],
}
const graph = {
  facets: [facet], soffits: [], sourceReconstructionId: 'recon-1',
  edges: [{
    id: 'e1', type: 'ridge', start: { x: 0, y: 0, z: 6 }, end: { x: 0, y: 10, z: 6 },
    length: 10, evidenceImageIds: ['img-1'],
  }],
  openings: [{ id: 'o1', type: 'unknown', width: null, height: null, evidenceImageIds: [] }],
  gutters: [{ id: 'g1', length: null, downspoutCount: null, evidenceImageIds: [] }],
}
const transform = { scale: 1, metricStatus: 'metric', manifestHash: 'a'.repeat(64) }
const input = {
  jobId: 'job-1', workspaceId: 'ws-1', reconstructionId: 'recon-1',
  graph, transform, manifestHash: 'a'.repeat(64),
}

const squares = pitchAdjustedSquares(1000, 6)
assert.ok(Math.abs(squares.roofAreaSqFt - 1000 * Math.sqrt(1.25)) < 0.01)
assert.ok(Math.abs(squares.squares - 11.1803398875) < 0.001)
const waste = wasteTable()
for (const material of ['shingle', 'tile', 'metal', 'membrane']) {
  assert.equal(typeof waste[material], 'number', `missing waste factor for ${material}`)
}

assert.equal(RULES_VERSION, '1.0.0')
const set = deriveMeasurements(input)
assert.equal(set.status, 'draft')
assert.equal(set.rulesetVersion, RULES_VERSION)
assert.equal(set.jobId, 'job-1')
assert.ok(set.records.length > 0)
assert.ok(set.records.every((record) => record.sourceRefs.length >= 1), 'every measurement needs evidence')

const area = set.records.find((record) => record.type === 'facet_area' && record.facetId === 'f1')
const truthArea = 12 * 10 * Math.sqrt(1.25)
assert.ok(area)
assert.ok(Math.abs(area.value - truthArea) / truthArea <= 0.03, 'facet area error must be <= 3%')

const pitch = set.records.find((record) => record.type === 'facet_pitch' && record.facetId === 'f1')
assert.ok(pitch)
assert.ok(Math.abs(pitch.value - 26.56505117707799) <= 2, 'pitch error must be <= 2 degrees')

const ridge = set.records.find((record) => record.type === 'ridge_lf')
assert.ok(ridge)
assert.equal(ridge.value, 10)
assert.ok(Math.abs(ridge.value - 10) / 10 <= 0.02)

const unknown = set.records.find((record) => record.type === 'opening')
assert.equal(unknown.value, null, 'unknown stays Unknown, never zero')
assert.ok(set.confidenceSummary.count === set.records.length)

const relative = deriveMeasurements({ ...input, transform: { ...transform, scale: null, metricStatus: 'relative-only' } })
assert.equal(relative.status, 'relative-only')
assert.equal(relative.records.length, 0, 'relative-only jobs publish no measurements')

console.log('hover-measurements-test: PASS')
