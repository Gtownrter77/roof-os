import { distance } from './geometry.ts'
import { roundTo, uuid } from './util.ts'
import type {
  Facet, FacetGraph, Gutter, LinearFeature, MetricTransform, Opening, ReconstructionRecord, Vec3,
} from './types.ts'

type TopologyOptions = {
  facets?: Facet[]
  semanticsAvailable?: boolean
  openings?: Opening[]
  gutters?: Gutter[]
}

const vertexKey = (point: Vec3) =>
  `${roundTo(point.x, 3)},${roundTo(point.y, 3)},${roundTo(point.z, 3)}`

function edgeKey(a: Vec3, b: Vec3): string {
  return [vertexKey(a), vertexKey(b)].sort().join('|')
}

function classifyEdge(
  facet: Facet,
  a: Vec3,
  b: Vec3,
  sharedWith: Facet | null,
): LinearFeature['type'] {
  const edgeZ = (a.z + b.z) / 2
  if (sharedWith) {
    const allZ = [...facet.vertices, ...sharedWith.vertices].map((point) => point.z)
    const maxZ = Math.max(...allZ)
    const minZ = Math.min(...allZ)
    if (edgeZ >= maxZ - 1e-6) return 'ridge'
    if (edgeZ <= minZ + 1e-6) return 'valley'
    return facet.vertices.length === 3 || sharedWith.vertices.length === 3 ? 'hip' : 'valley'
  }
  if (facet.role === 'soffit') return 'soffit'
  const facetZ = facet.vertices.map((point) => point.z)
  return edgeZ <= Math.min(...facetZ) + 1e-6 ? 'eave' : 'rake'
}

export function buildFacetGraph(
  reconstruction: Pick<ReconstructionRecord, 'id' | 'jobId' | 'manifestHash'>,
  transform: Pick<MetricTransform, 'scale' | 'metricStatus'>,
  options: TopologyOptions = {},
): FacetGraph {
  const facets = (options.facets ?? []).filter(
    (facet) => Array.isArray(facet.evidenceImageIds) && facet.evidenceImageIds.length > 0,
  )
  const scale = transform.scale ?? 1
  const seen = new Set<string>()
  const edges: LinearFeature[] = []

  for (const facet of facets) {
    for (let i = 0; i < facet.vertices.length; i++) {
      const a = facet.vertices[i]
      const b = facet.vertices[(i + 1) % facet.vertices.length]
      const key = edgeKey(a, b)
      if (seen.has(key)) continue
      seen.add(key)
      const sharedWith = facets.find((other) =>
        other.id !== facet.id &&
        other.vertices.some((point) => vertexKey(point) === vertexKey(a)) &&
        other.vertices.some((point) => vertexKey(point) === vertexKey(b)),
      ) ?? null
      edges.push({
        id: uuid(),
        type: classifyEdge(facet, a, b, sharedWith),
        start: a,
        end: b,
        length: distance(a, b) * scale,
        evidenceImageIds: [...facet.evidenceImageIds, ...(sharedWith?.evidenceImageIds ?? [])],
      })
    }
  }

  const openings: Opening[] = options.semanticsAvailable
    ? options.openings ?? []
    : [{ id: uuid(), type: 'unknown', width: null, height: null, evidenceImageIds: [] }]
  const gutters: Gutter[] = options.semanticsAvailable
    ? options.gutters ?? []
    : [{ id: uuid(), length: null, downspoutCount: null, evidenceImageIds: [] }]

  return {
    facets,
    edges,
    openings,
    gutters,
    soffits: facets.filter((facet) => facet.role === 'soffit'),
    sourceReconstructionId: reconstruction.id,
  }
}
