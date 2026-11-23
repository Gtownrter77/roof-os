import { wasteTable } from './measurements.ts'
import { stableStringify } from './report.ts'
import { hashText } from './util.ts'
import type {
  DesignQuantity, DesignSelection, FacetGraph, MaterialSelection, MeasurementSet,
} from './types.ts'

export type { MaterialSelection } from './types.ts'

export type DesignDiffEntry = {
  facetId: string
  field: string
  before: unknown
  after: unknown
}

/**
 * Material assignment is immutable: selections are applied to a copy of the facet graph
 * and quantities are recomputed from the locked measurement records, never typed by hand.
 */
export function applyDesign(input: {
  set: MeasurementSet
  graph: FacetGraph
  jobId: string
  facetGraphRef: string
  roofStyle?: string | null
  mode?: '2d-photo' | '3d-twin'
  selections: MaterialSelection[]
}): DesignSelection {
  const waste = wasteTable()
  const byFacet = new Map<string, MaterialSelection>()
  for (const selection of input.selections) byFacet.set(selection.facetId, selection)

  const facets = input.graph.facets.map((facet) => ({
    id: facet.id,
    material: byFacet.get(facet.id)?.material ?? facet.material,
  }))

  const areas = new Map<string, number>()
  for (const record of input.set.records) {
    if (record.type !== 'facet_area' || !record.facetId || record.value === null) continue
    areas.set(record.facetId, (areas.get(record.facetId) ?? 0) + record.value)
  }

  const quantities: DesignQuantity[] = facets.map((facet) => {
    const material = facet.material ?? 'shingle'
    const areaSqFt = areas.get(facet.id) ?? 0
    const wasteFactor = waste[material] ?? waste.shingle
    return {
      facetId: facet.id,
      material,
      areaSqFt,
      wasteFactor,
      quantitySqFt: Math.round(areaSqFt * (1 + wasteFactor) * 1000) / 1000,
    }
  })

  const selectionList = [...input.selections]
    .sort((a, b) => a.facetId.localeCompare(b.facetId))
    .map((selection) => ({
      facetId: selection.facetId,
      material: selection.material,
      color: selection.color ?? null,
      product: selection.product ?? null,
    }))

  const base = {
    jobId: input.jobId,
    setId: input.set.id,
    mode: input.mode ?? '2d-photo',
    roofStyle: input.roofStyle ?? null,
    facetGraphRef: input.facetGraphRef,
    selections: selectionList,
    facets,
    quantities,
  }
  return { ...base, hash: hashText(stableStringify(base)) }
}

export function designDiff(before: DesignSelection, after: DesignSelection): DesignDiffEntry[] {
  const entries: DesignDiffEntry[] = []
  const beforeFacetIds = new Set(before.facets.map((facet) => facet.id))
  const afterFacetIds = new Set(after.facets.map((facet) => facet.id))

  for (const id of new Set([...beforeFacetIds, ...afterFacetIds])) {
    const oldFacet = before.facets.find((facet) => facet.id === id)
    const newFacet = after.facets.find((facet) => facet.id === id)
    if ((oldFacet?.material ?? null) !== (newFacet?.material ?? null)) {
      entries.push({ facetId: id, field: 'material', before: oldFacet?.material ?? null, after: newFacet?.material ?? null })
    }
  }
  if (before.facetGraphRef !== after.facetGraphRef) {
    entries.push({ facetId: '*', field: 'facetGraphRef', before: before.facetGraphRef, after: after.facetGraphRef })
  }
  if (before.roofStyle !== after.roofStyle) {
    entries.push({ facetId: '*', field: 'roofStyle', before: before.roofStyle, after: after.roofStyle })
  }
  if (before.mode !== after.mode) {
    entries.push({ facetId: '*', field: 'mode', before: before.mode, after: after.mode })
  }
  return entries
}
