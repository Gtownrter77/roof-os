import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('app/api/photo-estimate/report/route.ts', 'utf8')
const page = readFileSync('app/photo-estimate/page.tsx', 'utf8')
const reports = readFileSync('app/reports/page.tsx', 'utf8')

assert.ok(route.includes("row.status !== 'approved'"), 'full reports require an approved workflow')
assert.ok(route.includes('getApprovedPhotoWorkflowQuantities(row)'), 'full reports use the approved quantity helper')
assert.ok(route.includes("source_photo_ids"), 'full reports include source photo IDs')
assert.ok(route.includes('stormCandidates: stormEvidence'), 'full reports include NOAA storm candidates')
assert.ok(route.includes("status: 'needs_human_review'"), 'full reports remain review-gated')
assert.ok(route.includes("report: nextReport"), 'full reports are persisted on the workflow')
assert.ok(route.includes("status: 'report_pending'"), 'the linked lead moves to report pending')
assert.ok(!route.includes('body.roofSquares'), 'full reports do not accept client roof quantities')
assert.ok(!route.includes('body.gutterLf'), 'full reports do not accept client gutter quantities')

assert.ok(page.includes("fetch('/api/photo-estimate/report'"), 'the photo workflow calls the full-report endpoint')
assert.ok(page.includes("workflow?.status === 'approved'"), 'the UI only offers full reports after approval')
assert.ok(page.includes('Generate full report'), 'the UI exposes full report generation')
assert.ok(page.includes('NOAA storm-event candidates'), 'the UI labels NOAA evidence')
assert.ok(page.includes('do not prove a date of loss'), 'the UI explains NOAA evidence limits')
assert.ok(page.includes('window.print()'), 'the report can be printed for review')
assert.ok(page.includes("new URLSearchParams(window.location.search).get('inspection')"), 'reports can open a specific inspection context')

assert.ok(reports.includes('Open photo-to-report workflow'), 'reports page routes into the real workflow')
assert.ok(!reports.includes('roofSquares: 1'), 'reports page no longer fabricates roof quantities')
assert.ok(!reports.includes("'/api/reports/inspection'"), 'reports page no longer uses the placeholder report API')

console.log('photo-full-report-flow-test: PASS')
