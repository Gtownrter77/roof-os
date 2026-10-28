/**
 * Local-first PDF normalizer.
 *
 * Turns structured Docling output into typed estimate rows with page
 * provenance. It is deterministic, offline, and review-only: no model call, no
 * provider key, no export. The normalizer only reshapes what Docling already
 * extracted; it never invents text, quantity, price, or a page number.
 */
import { parseDoclingDocument } from '../agent5/parser.ts'
import type { ExtractedLine } from '../agent5/types.ts'

export type PageProvenance = 'source' | 'synthesized'
export type RowKind = 'text_line' | 'table_row'

export interface NormalizedRow extends ExtractedLine {
  row_kind: RowKind
  /** Raw table cells when the row came from a table block. */
  cells: string[] | null
}

export interface NormalizedPage {
  page: number
  page_provenance: PageProvenance
  row_count: number
}

export interface NormalizeOptions {
  maxPages?: number
  maxBlocksPerPage?: number
  maxRows?: number
  maxTextChars?: number
}

export interface NormalizedDocument {
  document_id: string
  pages: NormalizedPage[]
  rows: NormalizedRow[]
  warnings: string[]
  truncated: boolean
  text_chars: number
  row_count: number
  table_row_count: number
  export_blocked: true
  review_required: true
}

const DEFAULTS = {
  maxPages: 200,
  maxBlocksPerPage: 500,
  maxRows: 5000,
  maxTextChars: 2_000_000,
}

const MAX_DOCUMENT_ID = 64

interface UnknownRecord {
  [key: string]: unknown
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Docling tables arrive as rows of cells. Accept strings or objects with a text field. */
function tableRows(cells: unknown): string[][] {
  if (!Array.isArray(cells)) return []
  const rows: string[][] = []
  for (const row of cells) {
    if (!Array.isArray(row)) continue
    const parts = row.map((cell) => {
      if (typeof cell === 'string') return clean(cell)
      if (isRecord(cell) && typeof cell.text === 'string') return clean(cell.text)
      return ''
    })
    if (parts.some((part) => part.length > 0)) rows.push(parts)
  }
  return rows
}

const HEADER_ALIASES: Record<string, 'item_code' | 'description' | 'quantity' | 'unit' | 'unit_cost'> = {
  item_code: 'item_code',
  code: 'item_code',
  cat: 'item_code',
  sel: 'item_code',
  description: 'description',
  desc: 'description',
  item: 'description',
  quantity: 'quantity',
  qty: 'quantity',
  unit: 'unit',
  uom: 'unit',
  unit_cost: 'unit_cost',
  unit_price: 'unit_cost',
  price: 'unit_cost',
}

function tableHeader(block: unknown): Array<'item_code' | 'description' | 'quantity' | 'unit' | 'unit_cost' | null> | null {
  if (!isRecord(block) || !Array.isArray(block.header)) return null
  const header = block.header.map((value) => {
    if (typeof value !== 'string') return null
    return HEADER_ALIASES[value.trim().toLowerCase()] ?? null
  })
  return header.some((role) => role !== null) ? header : null
}

/**
 * Map a table row through its declared header. A header is the only reason to
 * reorder cells; without one the row keeps its source order and typed fields
 * stay unknown rather than guessed.
 */
function headerRowText(cells: string[], header: Array<string | null>): string {
  const byRole: Partial<Record<'item_code' | 'description' | 'quantity' | 'unit' | 'unit_cost', string>> = {}
  cells.forEach((cell, index) => {
    const role = header[index]
    if (role && byRole[role] === undefined) byRole[role] = cell
  })
  const parts: string[] = []
  if (byRole.item_code) parts.push(byRole.item_code)
  if (byRole.quantity) parts.push(byRole.quantity)
  if (byRole.unit) parts.push(byRole.unit)
  if (byRole.unit_cost) parts.push(byRole.unit_cost.startsWith('$') ? byRole.unit_cost : `$${byRole.unit_cost}`)
  if (byRole.description) parts.push(byRole.description)
  return parts.join('  ')
}

function blockText(block: unknown): string {
  return isRecord(block) && typeof block.text === 'string' ? block.text : ''
}

/**
 * Normalize a Docling-style document. Unsupported input returns an empty,
 * explicitly review-blocked document instead of guessed rows.
 */
export function normalizeDoclingDocument(input: unknown, options: NormalizeOptions = {}): NormalizedDocument {
  const limits = {
    maxPages: options.maxPages ?? DEFAULTS.maxPages,
    maxBlocksPerPage: options.maxBlocksPerPage ?? DEFAULTS.maxBlocksPerPage,
    maxRows: options.maxRows ?? DEFAULTS.maxRows,
    maxTextChars: options.maxTextChars ?? DEFAULTS.maxTextChars,
  }
  const warnings: string[] = []
  const rows: NormalizedRow[] = []
  const pages: NormalizedPage[] = []
  let textChars = 0
  let truncated = false
  let tableRowCount = 0

  const rawId = isRecord(input) && typeof input.document_id === 'string' ? input.document_id.trim() : ''
  let documentId = rawId || 'unknown-document'
  if (!rawId) warnings.push('document_id missing; using unknown-document')
  if (documentId.length > MAX_DOCUMENT_ID) {
    documentId = documentId.slice(0, MAX_DOCUMENT_ID)
    warnings.push('document_id truncated to 64 characters')
  }

  if (!isRecord(input)) {
    return {
      document_id: documentId,
      pages,
      rows,
      warnings: [...warnings, 'document is not an object; no rows extracted'],
      truncated: false,
      text_chars: 0,
      row_count: 0,
      table_row_count: 0,
      export_blocked: true,
      review_required: true,
    }
  }

  const inputPages = Array.isArray(input.pages) ? input.pages : []
  if (inputPages.length === 0) warnings.push('document has no pages; no rows extracted')
  if (inputPages.length > limits.maxPages) {
    truncated = true
    warnings.push(`page limit ${limits.maxPages} reached; remaining pages were not read`)
  }

  for (const pageEntry of inputPages.slice(0, limits.maxPages)) {
    if (!isRecord(pageEntry)) {
      warnings.push('skipped a page that is not an object')
      continue
    }
    const sourcePage = positiveInteger(pageEntry.page)
    const page = sourcePage ?? pages.length + 1
    const provenance: PageProvenance = sourcePage === null ? 'synthesized' : 'source'
    if (sourcePage === null) warnings.push(`page ${page}: source page number missing; sequence synthesized`)
    if (pages.some((entry) => entry.page === page)) warnings.push(`page ${page}: duplicate page number in source`)

    const blocks = Array.isArray(pageEntry.blocks) ? pageEntry.blocks : []
    if (blocks.length === 0) warnings.push(`page ${page}: no blocks`)
    if (blocks.length > limits.maxBlocksPerPage) {
      truncated = true
      warnings.push(`page ${page}: block limit ${limits.maxBlocksPerPage} reached`)
    }

    // Parse the page once so provenance and block indexes stay tied to the source.
    const sanitizedBlocks: Array<{ text: string }> = []
    const kinds: Array<{ kind: RowKind; cells: string[] | null }> = []
    let skippedBlocks = 0

    for (const block of blocks.slice(0, limits.maxBlocksPerPage)) {
      const text = blockText(block)
      const header = tableHeader(block)
      const table = isRecord(block) ? tableRows(block.cells) : []
      if (text.trim()) {
        sanitizedBlocks.push({ text })
        const lineCount = text.split(/\r?\n/).filter((line) => line.trim().length > 0).length
        for (let index = 0; index < lineCount; index += 1) kinds.push({ kind: 'text_line', cells: null })
        textChars += text.length
      } else if (table.length > 0) {
        const texts = table.map((cells) => header ? headerRowText(cells, header) : cells.join('  '))
        sanitizedBlocks.push({ text: texts.join('\n') })
        for (const cells of table) kinds.push({ kind: 'table_row', cells })
        textChars += texts.reduce((sum, value) => sum + value.length, 0)
      } else {
        skippedBlocks += 1
      }
    }
    if (skippedBlocks > 0) warnings.push(`page ${page}: skipped ${skippedBlocks} block(s) without text or table cells`)

    const parsed = sanitizedBlocks.length > 0
      ? parseDoclingDocument({ document_id: documentId, pages: [{ page, blocks: sanitizedBlocks }] })
      : []
    if (parsed.length !== kinds.length) {
      warnings.push(`page ${page}: parser returned ${parsed.length} row(s) for ${kinds.length} expected line(s)`)
    }

    let pageRows = 0
    for (const [index, line] of parsed.entries()) {
      if (rows.length >= limits.maxRows) {
        truncated = true
        break
      }
      if (textChars > limits.maxTextChars) {
        truncated = true
        break
      }
      const meta = kinds[index] ?? { kind: 'text_line' as RowKind, cells: null }
      if (meta.kind === 'table_row') tableRowCount += 1
      rows.push({ ...line, row_kind: meta.kind, cells: meta.cells })
      pageRows += 1
    }
    pages.push({ page, page_provenance: provenance, row_count: pageRows })
    if (rows.length >= limits.maxRows) {
      warnings.push(`row limit ${limits.maxRows} reached; remaining rows were not read`)
      break
    }
    if (textChars > limits.maxTextChars) {
      warnings.push(`text limit ${limits.maxTextChars} characters reached; remaining rows were not read`)
      break
    }
  }

  return {
    document_id: documentId,
    pages,
    rows,
    warnings,
    truncated,
    text_chars: textChars,
    row_count: rows.length,
    table_row_count: tableRowCount,
    export_blocked: true,
    review_required: true,
  }
}
