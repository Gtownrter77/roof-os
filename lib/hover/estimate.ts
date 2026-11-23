import { assertPublishable } from './qa.ts'
import { stableStringify } from './report.ts'
import { hashText, uuid } from './util.ts'
import type {
  DesignSelection, Estimate, EstimateLine, InputManifest, MeasurementSet, QAState,
} from './types.ts'

export type PriceBook = {
  source: string
  at: string
  prices: Record<string, { price: number; unit: string; source?: string }>
}

export type EstimateInput = {
  set: MeasurementSet
  design: DesignSelection
  manifest: Pick<InputManifest, 'jobId' | 'workspaceId' | 'manifestHash'>
  priceBook: PriceBook
  qaState?: QAState
  variant?: string
}

export type EstimateDiffEntry = { code: string; field: string; before: unknown; after: unknown }

function validatePriceBook(priceBook: PriceBook): void {
  if (!priceBook || typeof priceBook.source !== 'string' || priceBook.source.trim() === '') {
    throw new Error('invalid price book: provenance source is required')
  }
  if (typeof priceBook.at !== 'string' || Number.isNaN(Date.parse(priceBook.at))) {
    throw new Error('invalid price book: timestamp is required')
  }
  if (!priceBook.prices || typeof priceBook.prices !== 'object') {
    throw new Error('invalid price book: prices must be an object')
  }
  for (const [code, entry] of Object.entries(priceBook.prices)) {
    if (!entry || typeof entry !== 'object' ||
        typeof entry.price !== 'number' || !Number.isFinite(entry.price) || entry.price < 0 ||
        typeof entry.unit !== 'string' || entry.unit.trim() === '' ||
        (entry.source !== undefined && (typeof entry.source !== 'string' || entry.source.trim() === ''))) {
      throw new Error(`invalid price book: malformed price entry ${code}`)
    }
  }
}

/** Prices come only from the supplied book. No model, AI or free text may write money. */
export function buildEstimate(input: EstimateInput): Estimate {
  validatePriceBook(input.priceBook)

  if (input.qaState) {
    assertPublishable(input.qaState)
  } else if (input.set.status !== 'locked' || !input.set.lockedBy) {
    throw new Error('cannot build estimate: measurement set is unlocked or missing owner lock')
  }

  const designQuantityByFacet = new Map(
    input.design.quantities.map((quantity) => [quantity.facetId, quantity]),
  )
  const lines: EstimateLine[] = []
  for (const record of input.set.records) {
    if (record.status === 'rejected' || record.type === 'unknown') continue
    const entry = input.priceBook.prices[record.type]
    const designed = record.facetId ? designQuantityByFacet.get(record.facetId) : undefined
    const quantity = designed?.quantitySqFt ?? record.value ?? 0
    lines.push({
      code: record.type,
      description: designed ? `Measured ${designed.material} at ${record.type}` : record.type,
      quantity,
      unit: entry?.unit ?? 'Unknown',
      price: entry?.price ?? null,
      priceSource: entry?.source ?? input.priceBook.source,
      measuredFrom: record.id,
    })
  }

  return {
    id: uuid(),
    jobId: input.set.jobId,
    variant: input.variant ?? 'base',
    lines,
    audit: {
      rulesetVersion: input.set.rulesetVersion,
      manifestHash: input.manifest.manifestHash,
      designHash: input.design.hash,
      priceBookHash: hashText(stableStringify(input.priceBook)),
      priceBookAt: input.priceBook.at,
    },
  }
}

export function estimateFromDesign(input: EstimateInput): Estimate {
  return buildEstimate(input)
}

export function estimateDiff(before: Estimate, after: Estimate): EstimateDiffEntry[] {
  const entries: EstimateDiffEntry[] = []
  const afterByCode = new Map(after.lines.map((line) => [line.code, line]))
  for (const line of before.lines) {
    const next = afterByCode.get(line.code)
    if (!next) {
      entries.push({ code: line.code, field: 'line', before: 'present', after: 'missing' })
      continue
    }
    for (const field of ['quantity', 'price', 'unit', 'priceSource'] as const) {
      if (line[field] !== next[field]) {
        entries.push({ code: line.code, field, before: line[field], after: next[field] })
      }
    }
  }
  return entries
}
