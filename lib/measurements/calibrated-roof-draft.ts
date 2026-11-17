import { aggregateTracePlanes } from './trace-geometry.ts'

export type GeometryPoint = { x: number; y: number }
export type ReviewedPlane = { vertices: GeometryPoint[]; review_status?: string; pitchRisePer12?: number }

export type CalibratedRoofDraftInput = {
  planes: ReviewedPlane[]
  scaleReferencePixels: number
  scaleReferenceFeet: number
  pitchRisePer12: number
  orthographicTopDownConfirmed: boolean
  uniformPitchConfirmed: boolean
  geometryConfirmed: boolean
}

export type CalibratedRoofDraft = {
  acceptedPlaneCount: number
  pixelsPerFoot: number
  planAreaSqFt: number
  roofAreaSqFt: number
  roofSquares: number
  slopeMultiplier: number
  pitchRisePer12: number
}

const MAX_REFERENCE_PIXELS = 200_000
const MAX_REFERENCE_FEET = 10_000
const MAX_PITCH_RISE_PER_12 = 36
const MAX_DRAFT_AREA_SQFT = 20_000_000

// Reject malformed AI polygons before a credible-looking area can enter the draft.
function polygonIsSelfIntersecting(vertices: GeometryPoint[]): boolean {
  const cross = (a: GeometryPoint, b: GeometryPoint, p: GeometryPoint) =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  const segmentIntersects = (a: GeometryPoint, b: GeometryPoint, c: GeometryPoint, d: GeometryPoint) => {
    const x = cross(a,b,c), y = cross(a,b,d), z = cross(c,d,a), w = cross(c,d,b)
    const on = (p: GeometryPoint, q: GeometryPoint, r: GeometryPoint) =>
      Math.abs(cross(p,q,r)) < 1e-9 && r.x >= Math.min(p.x,q.x)-1e-9 &&
      r.x <= Math.max(p.x,q.x)+1e-9 && r.y >= Math.min(p.y,q.y)-1e-9 &&
      r.y <= Math.max(p.y,q.y)+1e-9
    return ((x > 1e-9 && y < -1e-9 || x < -1e-9 && y > 1e-9) &&
      (z > 1e-9 && w < -1e-9 || z < -1e-9 && w > 1e-9)) ||
      on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b)
  }
  for (let i=0; i<vertices.length; i++) {
    const a=vertices[i], b=vertices[(i+1)%vertices.length]
    if (Math.hypot(a.x-b.x, a.y-b.y) < 1e-9) return true
    for (let j=i+1; j<vertices.length; j++) {
      if (j===i+1 || (i===0 && j===vertices.length-1)) continue
      if (segmentIntersects(a,b,vertices[j],vertices[(j+1)%vertices.length])) return true
    }
  }
  return false
}

function polygonAreaPixels(vertices: GeometryPoint[]) {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 100) {
    throw new RangeError('Each reviewed roof plane must contain 3–100 points.')
  }
  if (vertices.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
    throw new RangeError('Roof geometry contains a non-finite coordinate.')
  }
  if (polygonIsSelfIntersecting(vertices)) {
    throw new RangeError('Roof plane polygon overlaps itself or repeats adjacent vertices. Review AI geometry.')
  }
  let twiceArea = 0
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]
    const next = vertices[(index + 1) % vertices.length]
    if (!Number.isFinite(current?.x) || !Number.isFinite(current?.y)) throw new RangeError('Roof geometry contains a non-finite coordinate.')
    twiceArea += current.x * next.y - next.x * current.y
  }
  const area = Math.abs(twiceArea) / 2
  if (!Number.isFinite(area) || area < 0.5) throw new RangeError('Each reviewed roof plane must enclose a non-zero area.')
  return area
}

function roundHundredth(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateCalibratedRoofDraft(input: CalibratedRoofDraftInput): CalibratedRoofDraft {
  if (!Number.isFinite(input.scaleReferencePixels) || input.scaleReferencePixels <= 0 || input.scaleReferencePixels > MAX_REFERENCE_PIXELS) {
    throw new RangeError('The AI-formulated pixel reference must be between 0 and 200,000.')
  }
  if (!Number.isFinite(input.scaleReferenceFeet) || input.scaleReferenceFeet <= 0 || input.scaleReferenceFeet > MAX_REFERENCE_FEET) {
    throw new RangeError('The AI-formulated real-world reference must be between 0 and 10,000 feet.')
  }
  if (!Number.isFinite(input.pitchRisePer12) || input.pitchRisePer12 < 0 || input.pitchRisePer12 > MAX_PITCH_RISE_PER_12) {
    throw new RangeError('The AI-formulated pitch must be between 0/12 and 36/12.')
  }

  if (input.orthographicTopDownConfirmed !== true || input.geometryConfirmed !== true) {
    throw new RangeError('Confirm top-down imagery, scale and reviewed geometry before calculating a draft quantity.')
  }
  if (!Array.isArray(input.planes) ||
    input.planes.some(plane => !plane || !['accepted', 'edited', 'rejected'].includes(plane.review_status ?? ''))) {
    throw new RangeError('Accept or review every roof plane before calculating a draft quantity.')
  }
  const accepted = input.planes.filter(plane => plane.review_status !== 'rejected')
  if (!accepted.length) throw new RangeError('Accept or edit at least one roof plane before calculating a draft quantity.')
  if (input.uniformPitchConfirmed !== true &&
    accepted.some(plane => !Number.isFinite(plane.pitchRisePer12))) {
    throw new RangeError('Confirm each roof plane pitch when the roof does not have one uniform pitch.')
  }
  const pitches = accepted.map(plane => {
    const pitch = input.uniformPitchConfirmed ? input.pitchRisePer12 : plane.pitchRisePer12!
    if (!Number.isFinite(pitch) || pitch < 0 || pitch > MAX_PITCH_RISE_PER_12) {
      throw new RangeError('Each reviewed roof plane pitch must be between 0/12 and 36/12.')
    }
    if (input.uniformPitchConfirmed && plane.pitchRisePer12 !== undefined && plane.pitchRisePer12 !== pitch) {
      throw new RangeError('Reviewed plane pitch conflicts with confirmed uniform pitch.')
    }
    return pitch
  })

  // Validate each plane and the collection: self-intersection, containment,
  // crossings and shared boundaries are all checked before a quantity is released.
  const pixelAreas = accepted.map(plane => polygonAreaPixels(plane.vertices))
  const aggregate = aggregateTracePlanes(
    accepted.map(plane => plane.vertices.map(({ x, y }) => [y, x] as [number, number])),
    'pixels',
  )
  if (!aggregate.valid) throw new RangeError(aggregate.warning || 'Roof geometry is invalid.')
  const pixelsPerFoot = input.scaleReferencePixels / input.scaleReferenceFeet
  const planAreaSqFt = pixelAreas.reduce((sum, area) => sum + area, 0) / (pixelsPerFoot * pixelsPerFoot)
  const roofAreaSqFt = pixelAreas.reduce((sum, area, index) =>
    sum + area * Math.sqrt(1 + (pitches[index] / 12) ** 2), 0) / (pixelsPerFoot * pixelsPerFoot)
  const slopeMultiplier = roofAreaSqFt / planAreaSqFt
  const roofSquares = roofAreaSqFt / 100
  if (![pixelsPerFoot, planAreaSqFt, slopeMultiplier, roofAreaSqFt, roofSquares].every(Number.isFinite)
    || roofAreaSqFt <= 0 || roofAreaSqFt > MAX_DRAFT_AREA_SQFT) {
    throw new RangeError('The calculated draft quantity is outside supported limits.')
  }

  return {
    acceptedPlaneCount: accepted.length,
    pixelsPerFoot: roundHundredth(pixelsPerFoot),
    planAreaSqFt: roundHundredth(planAreaSqFt),
    roofAreaSqFt: roundHundredth(roofAreaSqFt),
    roofSquares: roundHundredth(roofSquares),
    slopeMultiplier: roundHundredth(slopeMultiplier),
    pitchRisePer12: input.pitchRisePer12,
  }
}
