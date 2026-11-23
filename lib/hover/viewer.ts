import type { FacetGraph, InputManifest, MeasurementSet, ViewerModel, ViewerOverlay } from './types.ts'

/**
 * The splat/mesh exists to orient a reviewer. Every number shown on top of it comes
 * from a locked measurement record with an evidence link — never from pixel distances.
 */
export const viewerCannotMeasure = true as const

export function buildViewerModel(input: {
  graph: FacetGraph
  set: MeasurementSet
  manifest: Pick<InputManifest, 'jobId' | 'manifestHash'>
  splatUrl?: string | null
}): ViewerModel {
  const overlays: ViewerOverlay[] = []
  if (input.set.status !== 'relative-only') {
    for (const record of input.set.records) {
      if (record.status === 'rejected') continue
      const evidenceImageId = record.sourceRefs.find((ref) => ref.imageId)?.imageId ?? null
      overlays.push({
        measurementId: record.id,
        label: record.value === null ? `${record.type}: Unknown` : `${record.type}: ${record.value} ${record.unit}`,
        value: record.value,
        unit: record.unit,
        evidenceImageId,
        evidenceImageIds: record.sourceRefs
          .map((ref) => ref.imageId)
          .filter((id): id is string => typeof id === 'string'),
        evidenceLinks: evidenceImageId
          ? [{ href: `/photos/${evidenceImageId}`, label: `Photo ${evidenceImageId}` }]
          : [],
      })
    }
  }
  return {
    facets: input.graph.facets,
    splatUrl: input.splatUrl ?? null,
    overlays,
    measurementSource: 'measurement-records',
    manifestHash: input.manifest.manifestHash,
    sourceReconstructionId: input.graph.sourceReconstructionId,
  }
}
