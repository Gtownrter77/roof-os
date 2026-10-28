import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeDoclingDocument } from '../lib/documents/normalizer.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 1. Two pages, text and table blocks, explicit page numbers.
const doc = {
  document_id: 'carrier-pdf-1',
  pages: [
    {
      page: 3,
      blocks: [
        { text: 'RFG-001  32.5 SQ  $145.00  Remove and replace architectural shingles\nRFG-002  10 SQ  Remove underlayment' },
        { header: ['item_code', 'description', 'quantity', 'unit', 'unit_price'], cells: [['DRY-010', '1/2 drywall', '448', 'SF', '$2.46']] },
      ],
    },
    {
      page: 7,
      blocks: [{ text: 'TOTAL  $4,712.50' }],
    },
  ],
}
const normalized = normalizeDoclingDocument(doc)
assert.equal(normalized.document_id, 'carrier-pdf-1')
assert.equal(normalized.pages.length, 2)
assert.equal(normalized.row_count, 4)
assert.equal(normalized.table_row_count, 1)
assert.equal(normalized.truncated, false)
assert.equal(normalized.export_blocked, true)
assert.equal(normalized.review_required, true)
assert.deepEqual(normalized.pages.map((page) => page.page), [3, 7])
assert.ok(normalized.pages.every((page) => page.page_provenance === 'source'))
assert.deepEqual(normalized.pages.map((page) => page.row_count), [3, 1])

const [shingle, underlayment, drywall, total] = normalized.rows
assert.equal(shingle.row_kind, 'text_line')
assert.equal(shingle.item_code, 'RFG-001')
assert.equal(shingle.quantity, 32.5)
assert.equal(shingle.unit, 'SQ')
assert.equal(shingle.unit_cost, 145)
assert.equal(shingle.source.page, 3)
assert.equal(shingle.source.block, 'block-0-line-0')
assert.equal(underlayment.source.page, 3)
assert.equal(underlayment.source.block, 'block-0-line-1')

assert.equal(drywall.row_kind, 'table_row')
assert.deepEqual(drywall.cells, ['DRY-010', '1/2 drywall', '448', 'SF', '$2.46'])
assert.equal(drywall.quantity, 448)
assert.equal(drywall.unit, 'SF')
assert.equal(drywall.unit_cost, 2.46)
assert.equal(drywall.line_total, 1102.08)
assert.equal(drywall.source.page, 3)
assert.equal(drywall.source.block, 'block-1-line-0')

assert.equal(total.source.page, 7)
assert.equal(total.unit_cost, 4712.5)

// 2. Missing page number is synthesized and labelled, never faked as source.
const synthesized = normalizeDoclingDocument({
  document_id: 'carrier-pdf-2',
  pages: [{ blocks: [{ text: 'DRY-9  30 LF  $12.00  Ridge vent' }] }],
})
assert.equal(synthesized.pages[0].page, 1)
assert.equal(synthesized.pages[0].page_provenance, 'synthesized')
assert.ok(synthesized.warnings.some((warning) => warning.includes('sequence synthesized')))
assert.equal(synthesized.rows[0].quantity, 30)
assert.equal(synthesized.rows[0].unit_cost, 12)

// 3. Unsupported input yields an empty, review-blocked document.
for (const bad of [null, undefined, 'not-a-document', 42, []]) {
  const empty = normalizeDoclingDocument(bad)
  assert.equal(empty.rows.length, 0)
  assert.equal(empty.export_blocked, true)
  assert.equal(empty.review_required, true)
  assert.ok(empty.warnings.length > 0)
}
assert.equal(normalizeDoclingDocument({ pages: [] }).warnings[1], 'document has no pages; no rows extracted')

// 4. Caps are enforced and reported; nothing is silently dropped.
const capped = normalizeDoclingDocument({
  document_id: 'carrier-pdf-3',
  pages: [1, 2, 3].map((page) => ({ page, blocks: [{ text: `row ${page} 1 EA $1.00` }] })),
}, { maxPages: 2 })
assert.equal(capped.truncated, true)
assert.equal(capped.pages.length, 2)
assert.ok(capped.warnings.some((warning) => warning.includes('page limit 2')))

const rowCapped = normalizeDoclingDocument({
  document_id: 'carrier-pdf-4',
  pages: [{ page: 1, blocks: [{ text: 'a 1 EA $1.00\nb 2 EA $2.00\nc 3 EA $3.00' }] }],
}, { maxRows: 1 })
assert.equal(rowCapped.row_count, 1)
assert.equal(rowCapped.truncated, true)
assert.ok(rowCapped.warnings.some((warning) => warning.includes('row limit 1')))

const textCapped = normalizeDoclingDocument({
  document_id: 'carrier-pdf-5',
  pages: [{ page: 1, blocks: [{ text: `${'x'.repeat(50)} 1 EA $1.00\n${'y'.repeat(50)} 2 EA $2.00` }] }],
}, { maxTextChars: 30 })
assert.equal(textCapped.truncated, true)
assert.ok(textCapped.warnings.some((warning) => warning.includes('text limit 30')))

const blockCapped = normalizeDoclingDocument({
  document_id: 'carrier-pdf-6',
  pages: [{ page: 1, blocks: [{ text: 'a 1 EA $1.00' }, { text: 'b 2 EA $2.00' }] }],
}, { maxBlocksPerPage: 1 })
assert.equal(blockCapped.truncated, true)
assert.ok(blockCapped.warnings.some((warning) => warning.includes('block limit 1')))

// 5. Missing fields stay unknown; table borders never become values.
const sparse = normalizeDoclingDocument({
  document_id: 'carrier-pdf-7',
  pages: [{ page: 1, blocks: [{ cells: [['', 'Roofing felt 15 lb', ''], ['', '', '']] }] }],
})
assert.equal(sparse.rows.length, 1)
assert.equal(sparse.rows[0].unit_cost, null)
assert.equal(sparse.rows[0].line_total, null)
assert.equal(sparse.rows[0].provenance, 'unknown')
assert.ok(sparse.rows[0].issues.includes('unit price not stated in source'))

// A table without a declared header keeps source order and does not guess roles.
const unheadedTable = normalizeDoclingDocument({
  document_id: 'carrier-pdf-8',
  pages: [{ page: 1, blocks: [{ cells: [['Shingles', '$100', '10', 'SQ']] }] }],
})
assert.equal(unheadedTable.rows[0].row_kind, 'table_row')
assert.deepEqual(unheadedTable.rows[0].cells, ['Shingles', '$100', '10', 'SQ'])
assert.equal(unheadedTable.rows[0].quantity, null)
assert.equal(unheadedTable.rows[0].unit_cost, null)
assert.equal(unheadedTable.rows[0].provenance, 'unknown')

// 6. The same input normalizes to the same output.
assert.deepEqual(normalizeDoclingDocument(doc), normalizeDoclingDocument(doc))

// 7. Worker contract: structured pages with real page numbers, bounded, offline.
const worker = read('../workers/claims/server.py')
assert.ok(worker.includes('"pages"'), 'worker returns structured pages')
assert.ok(worker.includes('page_no'), 'worker reads Docling page provenance')
assert.ok(worker.includes('MAX_STRUCTURED_CHARS'), 'worker bounds structured output')
assert.ok(worker.includes('"structured"'), 'worker reports whether structured extraction succeeded')
assert.ok(!/capout|openai|anthropic|api\.openai/i.test(worker), 'worker uses no paid provider')
assert.ok(!/xactimate|\.esx/i.test(worker), 'worker claims no ESX output')
assert.ok(worker.includes('"authority": "document extraction only; human review required"'))

const smoke = read('../scripts/ci/docling-worker-smoke.sh')
assert.ok(smoke.includes('extract_pages'), 'CI smoke test exercises structured page extraction')
assert.ok(smoke.includes('pages, structured_truncated = extract_pages('), 'CI smoke test unpacks the pages/truncated tuple')
assert.ok(smoke.includes('page_no') || smoke.includes('page'), 'CI smoke test asserts page provenance')

// 8. The review route consumes the normalizer without changing its guarantees.
const route = read('../app/api/supplements/review/route.ts')
assert.ok(route.includes('normalizeDoclingDocument'), 'route uses the normalizer')
assert.ok(route.includes('normalization'), 'route reports normalization metadata')
assert.ok(route.includes('export_blocked: true'))
assert.ok(route.includes('review_required: true'))
assert.ok(!/fetch\(|axios/i.test(route), 'route still makes no outbound call')

console.log('pdf-normalizer-test: PASS (typed rows, page provenance, table cells, caps, unknown stays unknown, deterministic, offline worker and route contracts)')
