import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDoclingDocument, parseStructuredLines } from '../lib/agent5/parser.ts'
import { compareScope } from '../lib/agent5/comparator.ts'
import { buildReviewPacket, compareRevisions } from '../lib/agent5/reviewer.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 1. Docling text with explicit code, quantity, unit and dollar price.
const doc = {
  document_id: 'carrier-1',
  pages: [{
    page: 2,
    blocks: [{
      text: [
        'RFG-001  32.5 SQ  $145.00  Remove and replace architectural shingles',
        'RFG-002  10 SQ  Remove underlayment',
        'Install ridge vent 30',
        'TOTAL  $4,712.50',
      ].join('\n'),
    }],
  }],
}
const lines = parseDoclingDocument(doc)
assert.equal(lines.length, 4)
assert.equal(lines[0].item_code, 'RFG-001')
assert.equal(lines[0].quantity, 32.5)
assert.equal(lines[0].unit, 'SQ')
assert.equal(lines[0].unit_cost, 145)
assert.equal(lines[0].line_total, 4712.5)
assert.equal(lines[0].provenance, 'source')
assert.equal(lines[0].source.page, 2)
assert.match(lines[0].source.block, /block-0-line-0/)

// Missing price is reported, never invented; bare numbers are not prices.
assert.equal(lines[1].quantity, 10)
assert.equal(lines[1].unit_cost, null)
assert.equal(lines[1].line_total, null)
assert.equal(lines[1].provenance, 'unknown')
assert.ok(lines[1].issues.includes('unit price not stated in source'))
assert.equal(lines[2].quantity, null)
assert.equal(lines[2].unit_cost, null)
assert.equal(lines[3].unit_cost, null)

// Malformed input yields no invented rows.
assert.deepEqual(parseDoclingDocument(null), [])
assert.deepEqual(parseDoclingDocument({ pages: 'nope' }), [])

// 2. Structured rows keep only stated values.
const structured = parseStructuredLines([
  { item_code: 'A1', description: 'Synthetic underlayment', category: 'material', quantity: '2', unit: 'SQ', unit_cost: '35' },
  { description: 'Unpriced labor line' },
], 'contractor-1')
assert.equal(structured[0].line_total, 70)
assert.equal(structured[0].provenance, 'source')
assert.equal(structured[1].quantity, null)
assert.equal(structured[1].provenance, 'unknown')

// 3. Comparator: missing scope, quantity delta, tolerance, code mismatch.
const carrier = parseStructuredLines([
  { item_code: 'M1', description: 'Architectural shingles', category: 'material', quantity: 10, unit: 'SQ', unit_cost: 100 },
  { item_code: 'L1', description: 'Tear off existing roof', category: 'labor', quantity: 10, unit: 'SQ', unit_cost: 50 },
  { item_code: 'M2', description: 'Ice and water shield', category: 'material', quantity: 2, unit: 'SQ', unit_cost: 90 },
], 'carrier')
const contractor = parseStructuredLines([
  { item_code: 'M1', description: 'Architectural shingles', category: 'material', quantity: 12, unit: 'SQ', unit_cost: 100 },
  { item_code: 'L9', description: 'Tear off existing roof', category: 'labor', quantity: 10, unit: 'SQ', unit_cost: 50 },
  { item_code: 'M3', description: 'Ridge vent replacement', category: 'material', quantity: 40, unit: 'LF', unit_cost: 12 },
], 'contractor')
const proposals = compareScope({ carrier, contractor, measurements: ['roof 12 SQ'] })
assert.ok(proposals.some((p) => p.kind === 'quantity_delta' && p.quantity_delta === 2 && p.amount_delta === 200))
assert.ok(proposals.some((p) => p.kind === 'missing_scope' && p.description.includes('Ridge vent')))
assert.ok(proposals.some((p) => p.kind === 'code_mismatch'))
assert.ok(!proposals.some((p) => p.kind === 'quantity_delta' && p.description.includes('Tear off')),
  'within-tolerance quantity must not raise a delta')

// No measurements -> explicit question, not a fabricated scope proposal.
const noMeasurements = compareScope({ carrier, contractor: [] })
assert.ok(noMeasurements.some((p) => p.kind === 'question' && p.description.includes('No verified measurements')))

// 4. Review packet is review-only and totals come from explicit rows only.
const packet = buildReviewPacket({ documentId: 'carrier', carrier, contractor, measurements: ['roof 12 SQ'] })
assert.equal(packet.status, 'ready_for_review')
assert.equal(packet.export_blocked, true)
assert.equal(packet.capout_required, false)
assert.equal(packet.totals.carrier_source_total, 1680)
assert.equal(packet.totals.contractor_total, 2180)
assert.equal(packet.totals.delta, 500)
assert.ok(packet.proposals.every((p) => p.requires_human_review === true))
assert.equal(packet.uncertainty.missing_quantity, 0)
assert.equal(packet.uncertainty.missing_price, 0)

// 5. Revision comparison is deterministic.
const revised = buildReviewPacket({
  documentId: 'carrier',
  carrier: parseStructuredLines([
    { item_code: 'M1', description: 'Architectural shingles', category: 'material', quantity: 11, unit: 'SQ', unit_cost: 100 },
    { item_code: 'M2', description: 'Ice and water shield', category: 'material', quantity: 2, unit: 'SQ', unit_cost: 90 },
  ], 'carrier-2'),
  contractor,
})
const diff = compareRevisions(packet, revised)
assert.ok(diff.changed.some((line) => line.includes('Architectural shingles')))
assert.ok(diff.removed.some((line) => line.includes('Tear off')))

// 6. API and migration source contracts.
const route = read('../app/api/supplements/review/route.ts')
const migration = read('../supabase/migrations/060_supplement_specialist_agent5.sql')
assert.ok(route.includes('requireWorkspaceMember'), 'API requires workspace membership')
assert.ok(route.includes("from('supplement_review_drafts')"), 'API persists review drafts')
assert.ok(route.includes('export_blocked: true'), 'API blocks export')
assert.ok(route.includes('previous_draft_id'), 'API supports revision comparison')
assert.ok(!/fetch\(|axios|from ['"]capout/i.test(route), 'API performs no external calls or CapOut dependency')
assert.ok(route.includes('review_required: true'), 'API marks output as human-review required')
assert.ok(!/insert\s+into|approve|auto_submit/i.test(route), 'API never auto-approves or auto-submits')
assert.ok(migration.includes('enable row level security'), 'migration enables RLS')
assert.ok(migration.includes('supplement_review_drafts_select'), 'workspace-scoped select policy')
assert.ok(migration.includes('public.is_workspace_admin'), 'approval requires admin')
assert.ok(!/for delete/i.test(migration), 'review history is append-only (no delete policy)')
assert.ok(migration.includes('assign_supplement_review_revision'), 'server assigns revisions')

// 7. Alternate and paid-when-incurred flags follow the documented review semantics:
// retained in the packet, excluded from totals and deltas, never priced here.
const alternates = parseStructuredLines([
  { item_code: 'A1', description: 'Architectural shingles', quantity: 10, unit: 'SQ', unit_cost: 100, enabled: 'yes' },
  { item_code: 'A2', description: 'Gutter apron alternate', quantity: 40, unit: 'LF', unit_cost: 5, enabled: '0' },
  { item_code: 'A3', description: 'Tarp and dry-in', quantity: 1, unit: 'EA', unit_cost: 250, paid_when_incurred: 'true' },
], 'carrier-alt')
assert.equal(alternates[0].enabled, true)
assert.equal(alternates[1].enabled, false)
assert.equal(alternates[2].paid_when_incurred, true)
const altPacket = buildReviewPacket({
  documentId: 'carrier-alt',
  carrier: alternates,
  contractor: parseStructuredLines([
    { item_code: 'A1', description: 'Architectural shingles', quantity: 10, unit: 'SQ', unit_cost: 100 },
  ], 'contractor-alt'),
  measurements: ['roof 10 SQ'],
})
assert.equal(altPacket.totals.carrier_source_total, 1250, 'alternate row stays out of the total')
assert.equal(altPacket.excluded.alternate_rows, 1)
assert.equal(altPacket.excluded.paid_when_incurred_rows, 1)
assert.ok(altPacket.lines.some((line) => line.item_code === 'A2'), 'alternate row is retained for review')
assert.ok(!altPacket.proposals.some((line) => line.description.includes('Gutter apron')),
  'an alternate carrier row never becomes a delta')

// A disabled contractor alternate must not look like missing scope.
const alternateContractor = buildReviewPacket({
  documentId: 'carrier-alt-2',
  carrier: parseStructuredLines([
    { item_code: 'A1', description: 'Architectural shingles', quantity: 10, unit: 'SQ', unit_cost: 100 },
  ], 'carrier-alt-2'),
  contractor: parseStructuredLines([
    { item_code: 'A1', description: 'Architectural shingles', quantity: 10, unit: 'SQ', unit_cost: 100 },
    { item_code: 'X9', description: 'Optional ridge upgrade', quantity: 2, unit: 'SQ', unit_cost: 10, enabled: false },
  ], 'contractor-alt-2'),
  measurements: ['roof 10 SQ'],
})
assert.ok(!alternateContractor.proposals.some((line) => line.description.includes('Optional ridge upgrade')),
  'a disabled contractor alternate never becomes missing scope')

// Omitted price stays unknown. It is never rewritten to $0.00.
const unpriced = parseStructuredLines([{ description: 'Roofing felt 15 lb', quantity: 10, unit: 'SQ' }], 'unpriced')
assert.equal(unpriced[0].unit_cost, null)
assert.equal(unpriced[0].line_total, null)
assert.equal(unpriced[0].provenance, 'unknown')
assert.ok(unpriced[0].issues.includes('unit price not stated in source'))

console.log('agent5-supplement-specialist-test: PASS (parser provenance, no invented values, comparator deltas, alternate/PWI flags, review-only packet, revisions, RLS source)')
