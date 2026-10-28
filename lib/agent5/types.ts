/** Shared types for the Agent 5 supplement specialist (review-only). */

export type SupplementCategory = 'material' | 'labor' | 'allowance' | 'fee' | 'tax'

export type Provenance = 'source' | 'inferred' | 'unknown'

export interface ExtractedLine {
  item_code: string | null
  description: string
  category: SupplementCategory | null
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  line_total: number | null
  provenance: Provenance
  confidence: number
  issues: string[]
  source: {
    document_id: string
    page: number
    block: string
    text: string
  }
}

export interface DoclingBlock {
  text?: unknown
}

export interface DoclingPage {
  page?: unknown
  blocks?: DoclingBlock[]
}

export interface DoclingDocument {
  document_id?: unknown
  pages?: DoclingPage[]
}

export interface StructuredLineInput {
  item_code?: string | null
  description?: string | null
  category?: string | null
  quantity?: number | string | null
  unit?: string | null
  unit_cost?: number | string | null
  line_total?: number | string | null
  page?: number | null
  block?: string | null
}

export interface GapProposal {
  kind: 'missing_scope' | 'quantity_delta' | 'unsupported_line' | 'code_mismatch' | 'question'
  description: string
  carrier_evidence: string[] | null
  contractor_evidence: string[] | null
  quantity_delta: number | null
  amount_delta: number | null
  confidence: number
  requires_human_review: true
}

export interface ReviewPacket {
  document_id: string
  status: 'ready_for_review'
  lines: ExtractedLine[]
  proposals: GapProposal[]
  totals: {
    carrier_source_total: number | null
    contractor_total: number | null
    delta: number | null
    currency: 'USD'
  }
  uncertainty: {
    unknown_provenance: number
    missing_quantity: number
    missing_price: number
    unresolved_proposals: number
  }
  export_blocked: true
  capout_required: false
  note: string
}
