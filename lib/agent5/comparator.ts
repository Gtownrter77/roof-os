/**
 * Agent 5 comparator — deterministic, evidence-first.
 *
 * Matches carrier lines to contractor/verified rows by explicit item code or
 * description token overlap. Proposals never assign a trade, price, code or
 * coverage that is absent from both sources.
 */
import type { ExtractedLine, GapProposal } from './types'

const STOP_WORDS = new Set([
  'and', 'the', 'with', 'for', 'per', 'of', 'to', 'a', 'an', 'on', 'in',
  'remove', 'install', 'replace', 'new', 'existing',
])

function tokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  )
}

function similarity(left: ExtractedLine, right: ExtractedLine): number {
  const a = tokens(left.description)
  const b = tokens(right.description)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / new Set([...a, ...b]).size
}

function sameLine(left: ExtractedLine, right: ExtractedLine): boolean {
  if (left.item_code && right.item_code) {
    if (left.item_code === right.item_code) return true
    return similarity(left, right) >= 0.75
  }
  return similarity(left, right) >= 0.6
}

function evidence(line: ExtractedLine): string {
  return `${line.source.document_id} p${line.source.page} ${line.source.block}: ${line.source.text}`
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export interface CompareInput {
  carrier: ExtractedLine[]
  contractor: ExtractedLine[]
  /** Measurement facts are references only; the engine does not convert them into scope. */
  measurements?: string[]
}

export function compareScope(input: CompareInput): GapProposal[] {
  const proposals: GapProposal[] = []
  const usedCarrier = new Set<number>()
  // Alternate/disabled rows stay in the packet for review, but they never
  // produce deltas or "missing scope" claims.
  const carrier = input.carrier.filter((line) => line.enabled)
  const contractor = input.contractor.filter((line) => line.enabled)

  for (const contractorLine of contractor) {
    let matchIndex = -1
    let bestScore = 0
    carrier.forEach((carrierLine, index) => {
      if (usedCarrier.has(index)) return
      if (sameLine(carrierLine, contractorLine)) {
        const score = carrierLine.item_code && contractorLine.item_code ? 1 : similarity(carrierLine, contractorLine)
        if (score > bestScore) {
          bestScore = score
          matchIndex = index
        }
      }
    })

    if (matchIndex === -1) {
      proposals.push({
        kind: 'missing_scope',
        description: `Contractor scope has no carrier match: ${contractorLine.description}`,
        carrier_evidence: null,
        contractor_evidence: [evidence(contractorLine)],
        quantity_delta: contractorLine.quantity,
        amount_delta: contractorLine.line_total,
        confidence: 0.6,
        requires_human_review: true,
      })
      continue
    }

    const carrierLine = carrier[matchIndex]
    usedCarrier.add(matchIndex)

    if (carrierLine.item_code && contractorLine.item_code && carrierLine.item_code !== contractorLine.item_code) {
      proposals.push({
        kind: 'code_mismatch',
        description: `Same scope matched by description but item codes differ (${carrierLine.item_code} vs ${contractorLine.item_code}).`,
        carrier_evidence: [evidence(carrierLine)],
        contractor_evidence: [evidence(contractorLine)],
        quantity_delta: null,
        amount_delta: null,
        confidence: 0.5,
        requires_human_review: true,
      })
    }

    if (carrierLine.quantity !== null && contractorLine.quantity !== null) {
      const delta = round(contractorLine.quantity - carrierLine.quantity)
      const tolerance = Math.max(0.01, Math.abs(carrierLine.quantity) * 0.02)
      if (Math.abs(delta) > tolerance) {
        const amountDelta = contractorLine.unit_cost !== null ? round(delta * contractorLine.unit_cost) : null
        proposals.push({
          kind: 'quantity_delta',
          description: `Quantity differs for "${carrierLine.description}": carrier ${carrierLine.quantity}${carrierLine.unit ?? ''} vs contractor ${contractorLine.quantity}${contractorLine.unit ?? ''}.`,
          carrier_evidence: [evidence(carrierLine)],
          contractor_evidence: [evidence(contractorLine)],
          quantity_delta: delta,
          amount_delta: amountDelta,
          confidence: 0.7,
          requires_human_review: true,
        })
      }
    } else {
      proposals.push({
        kind: 'question',
        description: `Quantity comparison unavailable for "${carrierLine.description}"; source does not state both quantities.`,
        carrier_evidence: [evidence(carrierLine)],
        contractor_evidence: [evidence(contractorLine)],
        quantity_delta: null,
        amount_delta: null,
        confidence: 0.4,
        requires_human_review: true,
      })
    }
  }

  carrier.forEach((carrierLine, index) => {
    if (usedCarrier.has(index)) return
    if (carrierLine.provenance === 'unknown' || carrierLine.quantity === null || carrierLine.line_total === null) {
      proposals.push({
        kind: 'unsupported_line',
        description: `Carrier line lacks complete source quantity/price: ${carrierLine.description}`,
        carrier_evidence: [evidence(carrierLine)],
        contractor_evidence: null,
        quantity_delta: null,
        amount_delta: null,
        confidence: 0.4,
        requires_human_review: true,
      })
    }
  })

  const measurements = input.measurements ?? []
  if (measurements.length === 0) {
    proposals.push({
      kind: 'question',
      description: 'No verified measurements were supplied; quantity deltas are not validated against field measurements.',
      carrier_evidence: null,
      contractor_evidence: null,
      quantity_delta: null,
      amount_delta: null,
      confidence: 1,
      requires_human_review: true,
    })
  }

  return proposals.slice(0, 200)
}
