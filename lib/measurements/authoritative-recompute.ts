import { calculateCalibratedRoofDraft } from './calibrated-roof-draft.ts'
import type { CalibratedRoofDraft, GeometryPoint } from './calibrated-roof-draft.ts'

// Callers (AI-formulated and manual-traced quantities) supply reviewed planes
// without a review_status; every plane handed to the calculator is accepted.
export type AuthoritativeRecomputePlane = {
  vertices: GeometryPoint[]
  pitchRisePer12: number | null
}

export type AuthoritativeRecomputeInput = {
  planes: AuthoritativeRecomputePlane[]
  scaleReferencePixels: number
  scaleReferenceFeet: number
  uniformPitchRisePer12: number
  uniformPitchConfirmed: boolean
  clientAreaSqft?: number | null
}

const STALE_AREA_TOLERANCE_SQFT = 0.05

// Single server-side authority for both ai_formulated and manual_traced
// quantities. All geometry and pitch validation stays in the draft calculator;
// this wrapper only marks the reviewed planes accepted and rejects a client
// area that no longer agrees with the recomputed area.
export function recomputeAuthoritativeArea(input: AuthoritativeRecomputeInput): CalibratedRoofDraft {
  const derived = calculateCalibratedRoofDraft({
    planes: input.planes.map((plane) => ({
      vertices: plane.vertices,
      review_status: 'accepted',
      ...(plane.pitchRisePer12 == null ? {} : { pitchRisePer12: plane.pitchRisePer12 }),
    })),
    scaleReferencePixels: input.scaleReferencePixels,
    scaleReferenceFeet: input.scaleReferenceFeet,
    pitchRisePer12: input.uniformPitchRisePer12,
    orthographicTopDownConfirmed: true,
    uniformPitchConfirmed: input.uniformPitchConfirmed,
    geometryConfirmed: true,
  })

  if (input.clientAreaSqft != null &&
    Math.abs(input.clientAreaSqft - derived.roofAreaSqFt) > STALE_AREA_TOLERANCE_SQFT) {
    throw new RangeError(
      `The client area is stale: ${input.clientAreaSqft} sq ft does not match the server-recomputed ${derived.roofAreaSqFt} sq ft.`,
    )
  }

  return derived
}
