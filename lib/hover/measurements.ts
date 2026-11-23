import { pitchFromNormal, polygonArea } from './geometry.ts'
import { roundTo, uuid, now } from './util.ts'
import type {
  EvidenceLink, FacetGraph, MeasurementRecord, MeasurementSet, MeasurementType, MetricTransform,
} from './types.ts'

export const RULES_VERSION = '1.0.0' as const

export function wasteTable(): Record<string, number> {
  return { shingle: 0.10, tile: 0.15, metal: 0.08, membrane: 0.12 }
}

export function pitchAdjustedSquares(planAreaSqFt: number, risePer12: number) {
  if (!Number.isFinite(planAreaSqFt) || planAreaSqFt <= 0) throw new TypeError('plan area must be positive')
  if (!Number.isFinite(risePer12) || risePer12 < 0) throw new TypeError('pitch must be non-negative')
  const slopeMultiplier = Math.sqrt(1 + (risePer12 / 12) ** 2)
  const roofAreaSqFt = planAreaSqFt * slopeMultiplier
  return {
    slopeMultiplier: roundTo(slopeMultiplier, 6),
    roofAreaSqFt: roundTo(roofAreaSqFt, 4),
    squares: roundTo(roofAreaSqFt / 100, 4),
  }
}

type DeriveInput = {
  jobId: string
  workspaceId: string
  reconstructionId: string | null
  graph: FacetGraph
  transform: MetricTransform
  manifestHash: string
}

const EDGE_RECORD_TYPES: Partial<Record<string, MeasurementType>> = {
  ridge: 'ridge_lf', hip: 'hip_lf', valley: 'valley_lf', eave: 'eave_lf', rake: 'rake_lf', gutter: 'gutter_lf',
}

function evidence(ids: string[], modelVersion: string | null): EvidenceLink[] {
  if (ids.length) return ids.map((imageId) => ({
    imageId, region: null, planeId: null, modelVersion,
  }))
  // A record with no image still carries the exact model version that produced it.
  return [{ imageId: null, region: null, planeId: null, modelVersion }]
}

export function deriveMeasurements(input: DeriveInput): MeasurementSet {
  const publishable = input.transform.scale !== null && input.transform.metricStatus === 'metric'
  const setId = uuid()
  const createdAt = now()
  const modelVersion = input.reconstructionId
  const waste = wasteTable()
  const records: MeasurementRecord[] = []

  const push = (
    type: MeasurementType, value: number | null, unit: string, confidence: number,
    sourceRefs: EvidenceLink[], facetId?: string,
  ) => {
    records.push({
      id: uuid(), setId, type, value: value === null ? null : roundTo(value, 4),
      unit, confidence: roundTo(Math.max(0, Math.min(1, confidence)), 3),
      sourceRefs, status: 'proposed', ...(facetId ? { facetId } : {}),
    })
  }

  if (publishable) {
    const scale = input.transform.scale as number
    let totalRoofArea = 0
    let totalWasteWeighted = 0

    for (const facet of input.graph.facets) {
      const area = polygonArea(facet.vertices) * scale * scale
      const refs = evidence(facet.evidenceImageIds, modelVersion)
      if (facet.role === 'roof') {
        push('facet_area', area, 'sqft', 0.85, refs, facet.id)
        push('facet_pitch', pitchFromNormal(facet.normal), 'deg', 0.8, refs, facet.id)
        totalRoofArea += area
        totalWasteWeighted += area * (waste[facet.material ?? 'shingle'] ?? waste.shingle)
      } else if (facet.role === 'wall') {
        push('siding_area', area, 'sqft', 0.7, refs, facet.id)
      }
    }
    if (totalRoofArea > 0) {
      const weightedWaste = totalWasteWeighted / totalRoofArea
      push('pitch_adjusted_squares', (totalRoofArea / 100) * (1 + weightedWaste), 'squares', 0.8,
        evidence(input.graph.facets[0]?.evidenceImageIds ?? [], modelVersion))
    }
    for (const soffit of input.graph.soffits) {
      push('soffit_area', polygonArea(soffit.vertices) * scale * scale, 'sqft', 0.75,
        evidence(soffit.evidenceImageIds, modelVersion), soffit.id)
    }
    for (const edge of input.graph.edges) {
      const type = EDGE_RECORD_TYPES[edge.type]
      if (type) push(type, edge.length, 'lf', 0.8, evidence(edge.evidenceImageIds, modelVersion))
    }
    for (const opening of input.graph.openings) {
      push('opening', opening.width, opening.width === null ? 'Unknown' : 'in', 0.6,
        evidence(opening.evidenceImageIds, modelVersion))
    }
    for (const gutter of input.graph.gutters) {
      if (gutter.length !== null) push('gutter_lf', gutter.length, 'lf', 0.7,
        evidence(gutter.evidenceImageIds, modelVersion))
      if (gutter.downspoutCount !== null) push('downspout_count', gutter.downspoutCount, 'count', 0.7,
        evidence(gutter.evidenceImageIds, modelVersion))
    }
  }

  const confidences = records.map((record) => record.confidence)
  return {
    id: setId,
    jobId: input.jobId,
    workspaceId: input.workspaceId,
    reconstructionId: input.reconstructionId,
    rulesetVersion: RULES_VERSION,
    status: publishable ? 'draft' : 'relative-only',
    records,
    confidenceSummary: {
      count: records.length,
      min: confidences.length ? Math.min(...confidences) : 0,
      mean: confidences.length ? roundTo(confidences.reduce((a, b) => a + b, 0) / confidences.length, 3) : 0,
    },
    lockedBy: null,
    lockedAt: null,
    createdAt,
  }
}
