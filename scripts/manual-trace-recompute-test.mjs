import assert from 'node:assert/strict'
import { calculateCalibratedRoofDraft } from '../lib/measurements/calibrated-roof-draft.ts'
import { recomputeAuthoritativeArea } from '../lib/measurements/authoritative-recompute.ts'

// Two disjoint rectangles in image-pixel space. Coordinates use the repo's
// GeometryPoint { x, y } shape; the draft calculator owns all area maths.
const planeOne = { vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 0, y: 30 }], pitchRisePer12: 4 }
const planeTwo = { vertices: [{ x: 60, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 30 }, { x: 60, y: 30 }], pitchRisePer12: 4 }
const base = {
  planes: [planeOne, planeTwo],
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  uniformPitchRisePer12: 4,
  uniformPitchConfirmed: true,
}

// (a) Matching area: the helper must be a thin wrapper around the authoritative
// draft calculator, with no second math engine and no client-area override.
const derived = recomputeAuthoritativeArea(base)
const expected = calculateCalibratedRoofDraft({
  planes: base.planes.map((plane) => ({ vertices: plane.vertices, review_status: 'accepted', pitchRisePer12: plane.pitchRisePer12 })),
  scaleReferencePixels: base.scaleReferencePixels,
  scaleReferenceFeet: base.scaleReferenceFeet,
  pitchRisePer12: base.uniformPitchRisePer12,
  orthographicTopDownConfirmed: true,
  uniformPitchConfirmed: true,
  geometryConfirmed: true,
})
assert.ok(derived.roofAreaSqFt > 0, 'recomputed roof area must be positive')
assert.deepEqual(derived, expected, 'helper must return exactly the authoritative draft calculator result')

// A client area inside the 0.05 sq ft tolerance is accepted, not treated as stale.
// Stay clear of the exact boundary, where binary floating point can round 0.05
// a fraction high; the stale guard itself uses the specified > 0.05 comparison.
assert.deepEqual(
  recomputeAuthoritativeArea({ ...base, clientAreaSqft: derived.roofAreaSqFt + 0.04 }),
  expected,
  'a client area within the 0.05 sq ft tolerance must pass',
)

// (b) Stale client area: a disagreement beyond 0.05 sq ft is rejected.
assert.throws(
  () => recomputeAuthoritativeArea({ ...base, clientAreaSqft: derived.roofAreaSqFt + 0.06 }),
  (error) => error instanceof RangeError && /stale/i.test(error.message),
  'a client area more than 0.05 sq ft from the recomputed area must throw a stale RangeError',
)

// (c) Missing per-plane pitch when the uniform pitch is not confirmed.
assert.throws(
  () => recomputeAuthoritativeArea({
    ...base,
    planes: [{ ...planeOne, pitchRisePer12: 4 }, { ...planeTwo, pitchRisePer12: null }],
    uniformPitchConfirmed: false,
  }),
  (error) => error instanceof RangeError && /pitch/i.test(error.message),
  'unconfirmed uniform pitch requires a finite pitch on every plane',
)

// (d) Self-intersecting (bow-tie) polygon must propagate the calculator's RangeError.
assert.throws(
  () => recomputeAuthoritativeArea({
    ...base,
    planes: [{ vertices: [{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 0, y: 30 }, { x: 40, y: 0 }], pitchRisePer12: null }],
  }),
  (error) => error instanceof RangeError && /overlaps itself/i.test(error.message),
  'malformed geometry must propagate a RangeError from the draft calculator',
)

// (e) Conflicting per-plane pitch when the uniform pitch is confirmed.
assert.throws(
  () => recomputeAuthoritativeArea({
    ...base,
    planes: [{ ...planeOne, pitchRisePer12: 4 }, { ...planeTwo, pitchRisePer12: 6 }],
  }),
  (error) => error instanceof RangeError && /conflict/i.test(error.message),
  'a per-plane pitch that disagrees with the confirmed uniform pitch must throw',
)

console.log('manual-trace-recompute-test: PASS (authoritative area, stale rejection, pitch and geometry guards)')
