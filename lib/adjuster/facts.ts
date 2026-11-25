// Claim fact normalization. Values are never invented: an absent or unknown
// price stays null, an unprovenanced code is dropped, and every absence is
// recorded as a scope gap for the plan.

import { assertNoFabrication, missingPrice } from '../jarvis/guards.ts'
import type { ClaimFacts } from '../jarvis/types.ts'

export const EXIF_STRIP_REQUIRED = true

type FactInput = {
  measurements?: Array<{ value: number; unit: string; provenance: string }>
  prices?: Array<{ amount?: unknown; provenance?: string }>
  coverage?: Array<{ description: string; provenance: string }>
  xactimateCodes?: Array<{ code?: string; provenance?: string }>
  scopeGaps?: string[]
}

export function buildClaimFacts(input: FactInput): ClaimFacts {
  const measurements = (input.measurements ?? []).map((item) => ({
    value: item.value,
    unit: item.unit,
    provenance: item.provenance ?? 'unknown',
  }))
  const prices = (input.prices ?? []).map((item) => ({
    amount: missingPrice(item.amount),
    provenance: item.provenance ?? 'unknown',
  }))
  const coverage = (input.coverage ?? []).map((item) => ({
    description: item.description,
    provenance: item.provenance ?? 'unknown',
  }))
  const xactimateCodes = (input.xactimateCodes ?? [])
    .filter((item) => typeof item.code === 'string' && item.code.trim() !== '')
    .filter((item) => item.provenance && item.provenance !== 'unknown')
    .map((item) => ({ code: item.code!.trim(), provenance: item.provenance! }))

  const facts: ClaimFacts = { measurements, prices, coverage, xactimateCodes, scopeGaps: input.scopeGaps ?? [] }
  facts.scopeGaps = [...new Set([...(input.scopeGaps ?? []), ...assertNoFabrication(facts)])]
  return facts
}

/** Free/open-source first; a paid fallback needs explicit owner approval. */
export function authorizeTool(
  tool: { name: string; license: string; cost: number },
  context: { ownerApproved: boolean },
): { allowed: boolean; reason?: string } {
  if (tool.cost <= 0) return { allowed: true }
  if (!context.ownerApproved) {
    return { allowed: false, reason: `Paid tool ${tool.name} requires explicit owner approval` }
  }
  return { allowed: true }
}
