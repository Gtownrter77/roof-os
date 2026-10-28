/**
 * Agent 5 review packet builder.
 *
 * Review-only: every packet is marked ready for human review and exports are
 * blocked. No automatic insurer contact, payment, or CapOut submission.
 */
import { compareScope } from './comparator.ts'
import { summarizeTotals } from './parser.ts'
import type { ExtractedLine, GapProposal, ReviewPacket } from './types'

export function buildReviewPacket(args: {
  documentId: string
  carrier: ExtractedLine[]
  contractor: ExtractedLine[]
  measurements?: string[]
}): ReviewPacket {
  const proposals = compareScope({
    carrier: args.carrier,
    contractor: args.contractor,
    measurements: args.measurements,
  })
  const carrierTotal = summarizeTotals(args.carrier)
  const contractorTotal = summarizeTotals(args.contractor)
  const delta = carrierTotal !== null && contractorTotal !== null
    ? Math.round((contractorTotal - carrierTotal) * 100) / 100
    : null

  return {
    document_id: args.documentId,
    status: 'ready_for_review',
    lines: args.carrier,
    proposals,
    totals: {
      carrier_source_total: carrierTotal,
      contractor_total: contractorTotal,
      delta,
      currency: 'USD',
    },
    uncertainty: {
      unknown_provenance: args.carrier.filter((line) => line.provenance === 'unknown').length,
      missing_quantity: args.carrier.filter((line) => line.quantity === null).length,
      missing_price: args.carrier.filter((line) => line.unit_cost === null && line.line_total === null).length,
      unresolved_proposals: proposals.filter((proposal) => proposal.kind === 'question').length,
    },
    excluded: {
      alternate_rows: args.carrier.filter((line) => !line.enabled).length,
      paid_when_incurred_rows: args.carrier.filter((line) => line.paid_when_incurred).length,
    },
    export_blocked: true,
    capout_required: false,
    note: 'Human review required. No automatic insurer submission or export.',
  }
}

export interface RevisionDiff {
  added: string[]
  removed: string[]
  changed: string[]
}

/** Compare two review packets by source text and explicit quantity. */
export function compareRevisions(previous: ReviewPacket, current: ReviewPacket): RevisionDiff {
  const key = (line: ExtractedLine) => `${line.item_code ?? ''}|${line.description.toLowerCase()}`
  const previousLines = new Map(previous.lines.map((line) => [key(line), line]))
  const currentLines = new Map(current.lines.map((line) => [key(line), line]))
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  for (const [lineKey, line] of currentLines) {
    const before = previousLines.get(lineKey)
    if (!before) {
      added.push(line.description)
      continue
    }
    if (before.quantity !== line.quantity || before.unit_cost !== line.unit_cost) {
      changed.push(`${line.description}: ${before.quantity ?? '?'} -> ${line.quantity ?? '?'}`)
    }
  }
  for (const [lineKey, line] of previousLines) {
    if (!currentLines.has(lineKey)) removed.push(line.description)
  }

  return { added, removed, changed }
}

export function countProposals(proposals: GapProposal[]): Record<GapProposal['kind'], number> {
  const counts: Record<GapProposal['kind'], number> = {
    missing_scope: 0,
    quantity_delta: 0,
    unsupported_line: 0,
    code_mismatch: 0,
    question: 0,
  }
  for (const proposal of proposals) counts[proposal.kind] += 1
  return counts
}
