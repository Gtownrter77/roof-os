import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getGoldenReportContractErrors, GOLDEN_REPORT_SECTION_IDS } from '../lib/reports/golden-report.mjs'

const route = readFileSync('app/api/photo-estimate/report/route.ts', 'utf8')
const page = readFileSync('app/photo-estimate/page.tsx', 'utf8')
const reports = readFileSync('app/reports/page.tsx', 'utf8')
const goldenReport = readFileSync('components/GoldenReport.tsx', 'utf8')
const goldenStandard = readFileSync('GOLDEN-REPORT.md', 'utf8')
const styles = readFileSync('app/globals.css', 'utf8')

assert.ok(route.includes("row.status !== 'approved'"), 'reports require an approved workflow')
assert.ok(route.includes('getApprovedPhotoWorkflowQuantities(row)'), 'reports use technician-approved quantities')
assert.ok(route.includes("source_photo_ids"), 'reports use saved photo IDs')
assert.ok(route.includes("from('inspection_photos')"), 'reports revalidate source photos in the same workspace and inspection')
assert.ok(route.includes("photo.upload_status !== 'uploaded'"), 'reports require every source photo upload to finish')
assert.ok(route.includes("version: 'golden-report-v1.0'"), 'reports follow the Golden Report version')
assert.ok(route.includes("status: 'draft'"), 'reports remain drafts until signatures are recorded')
assert.ok(route.includes('NOAA Storm Events Database'), 'reports name the exact required storm-history source')
assert.ok(!route.includes('storm_candidates'), 'weather alerts are not represented as NOAA Storm Events Database history')
assert.ok(!route.includes('row.ai_analysis'), 'the report excludes AI findings until technician confirmation exists')
assert.ok(route.includes("getGoldenReportContractErrors(fullReport)"), 'the server validates the report before saving it')
assert.ok(route.includes("report: nextReport"), 'the report is persisted on the workflow')
assert.ok(route.includes("status: 'report_pending'"), 'the linked lead moves to report pending')
assert.ok(!route.includes('body.roofSquares'), 'reports do not accept client roof quantities')
assert.ok(!route.includes('body.gutterLf'), 'reports do not accept client gutter quantities')
for (const id of GOLDEN_REPORT_SECTION_IDS) assert.ok(route.includes(`id: '${id}'`), `report contains the ${id} section`)

assert.ok(page.includes("fetch('/api/photo-estimate/report'"), 'the photo workflow calls the report endpoint')
assert.ok(page.includes("workflow?.status === 'approved'"), 'the UI only offers report generation after approval')
assert.ok(page.includes('Generate full report'), 'the UI exposes report generation')
assert.ok(page.includes('GoldenReport'), 'the photo workflow renders the canonical report component')
assert.ok(page.includes('window.print()'), 'the report can be printed')
assert.ok(page.includes("new URLSearchParams(window.location.search).get('inspection')"), 'the reports page can reopen an inspection context')
assert.ok(page.includes(".from('inspection_photos')"), 'reopening an inspection restores its saved photo metadata')
assert.ok(page.includes(".createSignedUrls(savedPhotoRows.map((photo) => photo.object_path), 3600)"), 'saved private source photos are re-signed for review')
assert.ok(page.includes(".from('photo_estimate_workflows')"), 'reopening an inspection restores its latest saved workflow')
assert.ok(page.includes('setFullReport(savedWorkflow.report?.fullReport ?? null)'), 'a previously generated report can be reopened')
assert.ok(goldenReport.includes('alt={photo.altText}'), 'every displayed source photo has plain alt text')
assert.ok(goldenReport.includes('Source: {item.source}'), 'each measurement states its source')
assert.ok(goldenReport.includes('section.statements?.map'), 'all standard sections are rendered')
assert.ok(route.includes('Unknown.'), 'missing report facts remain explicitly Unknown')
assert.ok(goldenReport.includes('photo-estimate-report'), 'the report has a dedicated print boundary')
assert.ok(goldenStandard.includes('Section 12 — Signatures'), 'the complete standard is documented in the repository')
assert.ok(goldenStandard.includes('until a technician confirms it'), 'the standard requires technician confirmation of AI observations')
assert.ok(styles.includes('.photo-estimate-report,') && styles.includes('visibility: visible !important'), 'print mode isolates the report from the surrounding app UI')
assert.ok(styles.includes('.golden-report-footer { position: fixed'), 'the report footer repeats on printed pages')
assert.ok(reports.includes('Open photo-to-report workflow'), 'the reports page opens the saved workflow')
assert.ok(!reports.includes('roofSquares: 1'), 'the reports page does not fabricate roof quantities')
assert.ok(!reports.includes("'/api/reports/inspection'"), 'the reports page does not use the placeholder API')

const sampleReport = {
  version: 'golden-report-v1.0',
  reportId: '11111111-1111-4111-8111-111111111111',
  status: 'draft',
  generatedAt: '2026-10-01T12:00:00.000Z',
  sourceEvidence: { photoIds: [], photoCount: 0 },
  sections: GOLDEN_REPORT_SECTION_IDS.map((id) => ({
    id,
    title: id,
    statements: ['Unknown.'],
    ...(id === 'measurements' ? { items: [{ label: 'Ridge', value: 'Unknown', source: 'Unknown.' }] } : {}),
    ...(id === 'looked-at' ? { photos: [] } : {}),
  })),
  footer: { motto: 'We educate. You decide.', text: 'Unknown.', company: 'Unknown', phone: 'Unknown' },
}
assert.deepEqual(getGoldenReportContractErrors(sampleReport), [], 'a complete, sourced-or-Unknown draft passes the rules engine')
assert.ok(getGoldenReportContractErrors({ ...sampleReport, status: 'approved' }).some((error) => error.includes('draft')), 'the validator rejects reports that bypass signature-gated draft status')
assert.ok(getGoldenReportContractErrors({ ...sampleReport, sections: sampleReport.sections.slice(1) }).some((error) => error.includes('12 Golden Report sections')), 'the validator rejects a missing standard section')
assert.ok(getGoldenReportContractErrors({ ...sampleReport, sections: sampleReport.sections.map((section) => section.id === 'measurements' ? { ...section, items: [{ label: 'Roof', value: '10 squares', source: '' }] } : section) }).some((error) => error.includes('labeled source')), 'the validator rejects values without sources')
const wrongPhoto = { id: '22222222-2222-4222-8222-222222222222', altText: 'Photo. Content unknown.', caption: 'Unknown', capturedAt: 'Unknown', mimeType: 'image/jpeg', usability: 'Unknown' }
assert.ok(getGoldenReportContractErrors({ ...sampleReport, sourceEvidence: { photoIds: ['11111111-1111-4111-8111-111111111111'], photoCount: 1 }, sections: sampleReport.sections.map((section) => section.id === 'looked-at' ? { ...section, photos: [wrongPhoto] } : section) }).some((error) => error.includes('match the persisted evidence order')), 'the validator rejects mismatched displayed and source photo IDs')
assert.ok(getGoldenReportContractErrors({ ...sampleReport, cost: '$100' }).some((error) => error.includes('Dollar amounts')), 'the validator rejects dollar amounts')
assert.ok(getGoldenReportContractErrors({ ...sampleReport, aiObservations: { summary: 'unconfirmed' } }).some((error) => error.includes('Unconfirmed AI')), 'the validator rejects unconfirmed AI output')

console.log('photo-full-report-flow-test: PASS (Golden Report template, unknown/source rules, technician gate, print/resume path)')
