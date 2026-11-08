export type GeometryPoint = { x: number; y: number }
export type ReviewedPlane = { vertices: GeometryPoint[]; review_status?: string }

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

function polygonAreaPixels(vertices: GeometryPoint[]) {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 100) {
    throw new RangeError('Each reviewed roof plane must contain 3–100 points.')
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
  if (!input.geometryConfirmed) throw new RangeError('Confirm reviewed geometry before calculating a draft quantity.')
  if (!input.orthographicTopDownConfirmed) throw new RangeError('A technician must confirm the image is top-down and orthographic before using one image scale.')
  if (!input.uniformPitchConfirmed) throw new RangeError('Confirm the entered measured pitch applies to every accepted roof plane.')
  if (!Number.isFinite(input.scaleReferencePixels) || input.scaleReferencePixels <= 0 || input.scaleReferencePixels > MAX_REFERENCE_PIXELS) {
    throw new RangeError('The human pixel reference must be between 0 and 200,000.')
  }
  if (!Number.isFinite(input.scaleReferenceFeet) || input.scaleReferenceFeet <= 0 || input.scaleReferenceFeet > MAX_REFERENCE_FEET) {
    throw new RangeError('The human real-world reference must be between 0 and 10,000 feet.')
  }
  if (!Number.isFinite(input.pitchRisePer12) || input.pitchRisePer12 < 0 || input.pitchRisePer12 > MAX_PITCH_RISE_PER_12) {
    throw new RangeError('Measured pitch must be between 0/12 and 36/12.')
  }
  if (!Array.isArray(input.planes) || input.planes.some((plane) => !['accepted', 'edited', 'rejected'].includes(plane.review_status ?? 'pending'))) {
    throw new RangeError('Review every suggested roof plane before calculating draft quantities.')
  }

  const accepted = input.planes.filter((plane) => plane.review_status === 'accepted' || plane.review_status === 'edited')
  if (!accepted.length) throw new RangeError('Accept or edit at least one roof plane before calculating a draft quantity.')

  const pixelsPerFoot = input.scaleReferencePixels / input.scaleReferenceFeet
  const planAreaSqFt = accepted.reduce((total, plane) => total + polygonAreaPixels(plane.vertices), 0) / (pixelsPerFoot * pixelsPerFoot)
  const slopeMultiplier = Math.sqrt(1 + (input.pitchRisePer12 / 12) ** 2)
  const roofAreaSqFt = planAreaSqFt * slopeMultiplier
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
