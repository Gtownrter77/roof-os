import { GEOMETRY_CONTRACT_VERSION, GeometryContractValidationError, validateGeometrySuggestion } from '../ai/geometry-contract.ts'
import type { Point } from '../ai/geometry-contract.ts'

// The UUID shape shared with lib/api-security.ts, kept local so this validator
// stays a pure function with no Next.js or Supabase dependency.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_IMAGE_DIMENSION = 100_000
const MAX_SCALE_PIXELS = 200_000
const MAX_SCALE_FEET = 10_000
const MAX_PITCH_RISE_PER_12 = 36

export type ManualTracePlane = {
  vertices: Point[]
  pitchRisePer12: number | null
}

export type ManualTraceInput = {
  inspectionId: string
  photoId: string
  imageWidth: number
  imageHeight: number
  planes: ManualTracePlane[]
  scaleReferencePixels: number
  scaleReferenceFeet: number
}

export class ManualTraceValidationError extends Error {}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ManualTraceValidationError(`${name} must be a finite number.`)
  }
  return value
}

function dimension(value: unknown, name: string): number {
  const result = finiteNumber(value, name)
  if (!Number.isInteger(result) || result < 1 || result > MAX_IMAGE_DIMENSION) {
    throw new ManualTraceValidationError(`${name} must be an integer between 1 and ${MAX_IMAGE_DIMENSION}.`)
  }
  return result
}

function scale(value: unknown, name: string, max: number): number {
  const result = finiteNumber(value, name)
  // A zero scale cannot produce a positive pixels-per-foot ratio, and the
  // calibrated_measurement DB constraint requires a strictly positive scale.
  if (result <= 0 || result > max) {
    throw new ManualTraceValidationError(`${name} must be greater than 0 and at most ${max}.`)
  }
  return result
}

function pitch(value: unknown, index: number): number | null {
  if (value === null) return null
  const result = finiteNumber(value, `Plane ${index + 1} pitchRisePer12`)
  if (result < 0 || result > MAX_PITCH_RISE_PER_12) {
    throw new ManualTraceValidationError(`Plane ${index + 1} pitchRisePer12 must be null or between 0 and ${MAX_PITCH_RISE_PER_12}.`)
  }
  return result
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ManualTraceValidationError(`${name} must be a valid UUID.`)
  }
  return value
}

/**
 * Validate a technician's hand-traced polygons without trusting any client area.
 * Polygon bounds, minimum vertex count, finite points and self-intersection are
 * all enforced by the shared geometry contract; only vertices and per-plane
 * pitch survive into the result.
 */
export function validateManualTraceInput(body: unknown): ManualTraceInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ManualTraceValidationError('The hand-trace body must be an object.')
  }
  const input = body as Record<string, unknown>
  const inspectionId = uuid(input.inspectionId, 'inspectionId')
  const photoId = uuid(input.photoId, 'photoId')
  const imageWidth = dimension(input.imageWidth, 'imageWidth')
  const imageHeight = dimension(input.imageHeight, 'imageHeight')
  const scaleReferencePixels = scale(input.scaleReferencePixels, 'scaleReferencePixels', MAX_SCALE_PIXELS)
  const scaleReferenceFeet = scale(input.scaleReferenceFeet, 'scaleReferenceFeet', MAX_SCALE_FEET)

  if (!Array.isArray(input.planes) || input.planes.length < 1) {
    throw new ManualTraceValidationError('At least one hand-traced roof plane is required.')
  }
  const rawPlanes = input.planes.map((plane, index) => {
    if (plane === null || typeof plane !== 'object' || Array.isArray(plane)) {
      throw new ManualTraceValidationError(`Plane ${index + 1} must be an object.`)
    }
    const record = plane as Record<string, unknown>
    if (!Array.isArray(record.vertices)) {
      throw new ManualTraceValidationError(`Plane ${index + 1} vertices must be an array.`)
    }
    return { vertices: record.vertices, pitchRisePer12: pitch(record.pitchRisePer12, index) }
  })

  let validated
  try {
    validated = validateGeometrySuggestion({
      contract_version: GEOMETRY_CONTRACT_VERSION,
      image_width: imageWidth,
      image_height: imageHeight,
      source_image_reference: 'manual-trace',
      planes: rawPlanes.map((plane, index) => ({
        id: `plane-${index + 1}`,
        vertices: plane.vertices,
        suggested_pitch: null,
        confidence: 'high',
        suggestion_status: 'accepted',
      })),
      edges: [],
      objects: [],
      warnings: [],
    })
  } catch (error) {
    if (error instanceof GeometryContractValidationError) {
      throw new ManualTraceValidationError(`Invalid hand-traced geometry: ${error.message}`)
    }
    throw error
  }

  return {
    inspectionId,
    photoId,
    imageWidth,
    imageHeight,
    planes: validated.planes.map((plane, index) => ({
      vertices: plane.vertices,
      pitchRisePer12: rawPlanes[index].pitchRisePer12,
    })),
    scaleReferencePixels,
    scaleReferenceFeet,
  }
}
