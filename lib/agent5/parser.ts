/**
 * Agent 5 parser — deterministic, local-first.
 *
 * Accepts Docling-style extracted text (pages/blocks) or structured rows.
 * Every line keeps its source reference. Numbers are parsed only when the
 * source states them explicitly; nothing is inferred into quantity or price.
 */
import type {
  DoclingDocument,
  ExtractedLine,
  Provenance,
  StructuredLineInput,
  SupplementCategory,
} from './types'

const UNITS = new Set([
  'SQ', 'SF', 'LF', 'SY', 'CY', 'EA', 'HR', 'GAL', 'BX', 'RL', 'PC', 'TON', 'LB', 'MI',
])

const CATEGORY_HINTS: Array<{ category: SupplementCategory; words: string[] }> = [
  { category: 'labor', words: ['labor', 'install', 'remove', 'tear off', 'tear-off', 'crew', 'hour'] },
  { category: 'material', words: ['shingle', 'underlayment', 'flashing', 'ridge', 'fascia', 'soffit', 'decking', 'ice and water', 'drip edge'] },
  { category: 'allowance', words: ['allowance'] },
  { category: 'fee', words: ['fee', 'permit', 'disposal', 'dumpster'] },
  { category: 'tax', words: ['tax'] },
]

const CATEGORY_VALUES = new Set<SupplementCategory>(['material', 'labor', 'allowance', 'fee', 'tax'])

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[$,\s]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const TRUE_FLAGS = new Set(['true', 'yes', '1'])
const FALSE_FLAGS = new Set(['false', 'no', '0'])

/** Strict flag parsing. An unrecognized value returns null so the caller keeps its documented default. */
function parseFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (TRUE_FLAGS.has(normalized)) return true
  if (FALSE_FLAGS.has(normalized)) return false
  return null
}

function inferCategory(description: string): { category: SupplementCategory | null; confidence: number } {
  const lower = description.toLowerCase()
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => lower.includes(word))) {
      return { category: hint.category, confidence: 0.55 }
    }
  }
  return { category: null, confidence: 0.3 }
}

function textLineToLine(
  text: string,
  source: ExtractedLine['source'],
): ExtractedLine {
  const issues: string[] = []
  let itemCode: string | null = null
  let quantity: number | null = null
  let unit: string | null = null
  let unitCost: number | null = null
  let description = text

  // Explicit code: short alphanumeric token with a separator.
  const codeMatch = text.match(/^([A-Z][A-Z0-9._-]{1,15})\s{2,}(.*)$/)
  if (codeMatch) {
    itemCode = codeMatch[1]
    description = codeMatch[2]
  }

  // Explicit quantity + unit at the start of the remaining text.
  const quantityMatch = description.match(/^(\d+(?:[.,]\d+)?)\s*([A-Z]{1,3})\b\s*(.*)$/)
  if (quantityMatch && UNITS.has(quantityMatch[2].toUpperCase())) {
    quantity = parseNumber(quantityMatch[1].replace(',', '.'))
    unit = quantityMatch[2].toUpperCase()
    description = quantityMatch[3]
  }

  // Explicit price: a dollar sign is required. Bare numbers are never treated as prices.
  const priceMatch = description.match(/^\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(.*)$/)
  if (priceMatch) {
    // The price pattern uses commas only as thousands separators.
    unitCost = parseNumber(priceMatch[1].replace(/,/g, ''))
    description = priceMatch[2]
  }

  description = description.trim()
  if (!description) {
    issues.push('description missing after structured fields')
    description = text
  }
  if (quantity === null) issues.push('quantity not stated in source')
  if (unitCost === null) issues.push('unit price not stated in source')

  const inferred = inferCategory(description)
  let provenance: Provenance = 'source'
  if (itemCode === null || quantity === null || unitCost === null) provenance = 'unknown'
  if (provenance === 'source' && inferred.category === null) provenance = 'inferred'

  const lineTotal = quantity !== null && unitCost !== null
    ? Math.round(quantity * unitCost * 100) / 100
    : null

  return {
    item_code: itemCode,
    description,
    category: inferred.category,
    quantity,
    unit,
    unit_cost: unitCost,
    line_total: lineTotal,
    enabled: true,
    paid_when_incurred: false,
    provenance,
    confidence: provenance === 'source' ? 0.85 : provenance === 'inferred' ? 0.6 : 0.2,
    issues,
    source,
  }
}

/** Parse a Docling-style document. Unsupported shapes yield an empty result, never invented rows. */
export function parseDoclingDocument(input: unknown): ExtractedLine[] {
  if (!input || typeof input !== 'object') return []
  const doc = input as DoclingDocument
  const documentId = cleanText(doc.document_id) || 'unknown-document'
  const pages = Array.isArray(doc.pages) ? doc.pages : []
  const lines: ExtractedLine[] = []

  pages.forEach((page, pageIndex) => {
    const pageNumber = typeof page?.page === 'number' && page.page > 0 ? page.page : pageIndex + 1
    const blocks = Array.isArray(page?.blocks) ? page.blocks : []
    blocks.forEach((block, blockIndex) => {
      const text = typeof block?.text === 'string' ? block.text : ''
      if (!text.trim()) return
      for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
        const line = rawLine.trim()
        if (!line) continue
        lines.push(textLineToLine(line, {
          document_id: documentId,
          page: pageNumber,
          block: `block-${blockIndex}-line-${lineIndex}`,
          text: line,
        }))
      }
    })
  })

  return lines
}

/** Structured carrier/contractor rows supplied by a trusted API caller. */
export function parseStructuredLines(
  rows: unknown,
  documentId: string,
): ExtractedLine[] {
  if (!Array.isArray(rows)) return []
  const lines: ExtractedLine[] = []
  rows.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return
    const row = raw as StructuredLineInput
    const description = cleanText(row.description)
    if (!description) return
    const category = typeof row.category === 'string' && CATEGORY_VALUES.has(row.category as SupplementCategory)
      ? row.category as SupplementCategory
      : inferCategory(description).category
    const quantity = parseNumber(row.quantity)
    const unitCost = parseNumber(row.unit_cost)
    const providedTotal = parseNumber(row.line_total)
    const lineTotal = providedTotal ?? (quantity !== null && unitCost !== null
      ? Math.round(quantity * unitCost * 100) / 100
      : null)
    const issues: string[] = []
    if (quantity === null) issues.push('quantity not stated in source')
    if (unitCost === null && providedTotal === null) issues.push('unit price not stated in source')
    const enabled = parseFlag(row.enabled) ?? true
    if (!enabled) issues.push('alternate row excluded from totals and deltas')
    lines.push({
      item_code: cleanText(row.item_code) || null,
      description,
      category,
      quantity,
      unit: cleanText(row.unit).toUpperCase() || null,
      unit_cost: unitCost,
      line_total: lineTotal,
      enabled,
      paid_when_incurred: parseFlag(row.paid_when_incurred) ?? false,
      provenance: quantity !== null && (unitCost !== null || providedTotal !== null) ? 'source' : 'unknown',
      confidence: quantity !== null && (unitCost !== null || providedTotal !== null) ? 0.9 : 0.3,
      issues,
      source: {
        document_id: documentId,
        page: typeof row.page === 'number' && row.page > 0 ? row.page : 1,
        block: cleanText(row.block) || `row-${index}`,
        text: description,
      },
    })
  })
  return lines
}

export function summarizeTotals(lines: ExtractedLine[]): number | null {
  const priced = lines.filter((line) => line.enabled && line.line_total !== null)
  if (priced.length === 0) return null
  return Math.round(priced.reduce((sum, line) => sum + (line.line_total ?? 0), 0) * 100) / 100
}
