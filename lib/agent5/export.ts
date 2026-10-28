/**
 * Agent 5 review export — deterministic JSON and CSV for human review.
 *
 * This is an internal review copy of a packet. It is not an ESX file, is not
 * insurer-submittable, and is never sent anywhere by this module. Export here
 * means "give the reviewer a file they can read", not "file a claim".
 */
import type { GapProposal, ReviewPacket } from './types'

export const REVIEW_EXPORT_SCHEMA = 'roof-os.agent5.review-export.v1'

export type ReviewExportFormat = 'json' | 'csv'

export interface ReviewExportBoundaries {
  generated_for: 'human_review'
  external_submission: false
  insurer_submission: false
  esx_compatible: false
  export_blocked: true
}

export interface ReviewExportEnvelope {
  schema: typeof REVIEW_EXPORT_SCHEMA
  document_id: string
  packet_status: ReviewPacket['status']
  totals: ReviewPacket['totals']
  uncertainty: ReviewPacket['uncertainty']
  excluded: ReviewPacket['excluded']
  proposals: GapProposal[]
  lines: ReviewPacket['lines']
  boundaries: ReviewExportBoundaries
}

const BOUNDARIES: ReviewExportBoundaries = {
  generated_for: 'human_review',
  external_submission: false,
  insurer_submission: false,
  esx_compatible: false,
  export_blocked: true,
}

export const REVIEW_CSV_COLUMNS = [
  'section',
  'item_code',
  'description',
  'category',
  'quantity',
  'unit',
  'unit_cost',
  'line_total',
  'provenance',
  'enabled',
  'paid_when_incurred',
  'proposal_kind',
  'quantity_delta',
  'amount_delta',
  'carrier_evidence',
  'contractor_evidence',
  'requires_human_review',
] as const

export function buildReviewExport(packet: ReviewPacket): ReviewExportEnvelope {
  return {
    schema: REVIEW_EXPORT_SCHEMA,
    document_id: packet.document_id,
    packet_status: packet.status,
    totals: packet.totals,
    uncertainty: packet.uncertainty,
    excluded: packet.excluded,
    proposals: packet.proposals,
    lines: packet.lines,
    boundaries: { ...BOUNDARIES },
  }
}

/** Deterministic JSON. Same packet in, same bytes out. */
export function toReviewJson(packet: ReviewPacket): string {
  return `${JSON.stringify(buildReviewExport(packet), null, 2)}\n`
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

/** Deterministic CSV: one line per carrier line, then one line per proposal. */
export function toReviewCsv(packet: ReviewPacket): string {
  const rows: string[] = [REVIEW_CSV_COLUMNS.join(',')]

  for (const line of packet.lines) {
    rows.push(csvRow([
      'line',
      line.item_code,
      line.description,
      line.category,
      line.quantity,
      line.unit,
      line.unit_cost,
      line.line_total,
      line.provenance,
      line.enabled,
      line.paid_when_incurred,
      null,
      null,
      null,
      null,
      null,
      null,
    ]))
  }

  for (const proposal of packet.proposals) {
    rows.push(csvRow([
      'proposal',
      null,
      proposal.description,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      proposal.kind,
      proposal.quantity_delta,
      proposal.amount_delta,
      proposal.carrier_evidence ? proposal.carrier_evidence.join(' | ') : null,
      proposal.contractor_evidence ? proposal.contractor_evidence.join(' | ') : null,
      proposal.requires_human_review,
    ]))
  }

  return `${rows.join('\n')}\n`
}

export function buildReviewExportFile(packet: ReviewPacket, format: ReviewExportFormat): {
  content: string
  filename: string
  content_type: string
} {
  const safeDocumentId = packet.document_id
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.{2,}/g, '_')
    .slice(0, 64) || 'supplement-review'
  if (format === 'csv') {
    return {
      content: toReviewCsv(packet),
      filename: `${safeDocumentId}-review.csv`,
      content_type: 'text/csv;charset=utf-8',
    }
  }
  return {
    content: toReviewJson(packet),
    filename: `${safeDocumentId}-review.json`,
    content_type: 'application/json;charset=utf-8',
  }
}
