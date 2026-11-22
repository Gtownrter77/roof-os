import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clearStaleManagerApproval, hasValidManagerApproval } from '../lib/estimates/photo-approval.ts'
import { isTechnicianSignature } from '../lib/reports/golden-report.mjs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const SIG = 'data:image/png;base64,iVBORw0KGgo='
const WORKFLOW_ID = '11111111-1111-4111-8111-111111111111'
const WS_ID = '22222222-2222-4222-8222-222222222222'
const INSPECTION_ID = '33333333-3333-4333-8333-333333333333'
const APPROVER = '44444444-4444-4444-8444-444444444444'
const VERIFIED_AT = '2026-11-20T10:00:00.000Z'

// A technician re-verification (or a new photo review) must erase every trace
// of the previous manager approval, including the generated full report.
const staleReport = {
  status: 'approved_for_customer_packet',
  technicianVerification: { verifiedAt: VERIFIED_AT, decision: 'verified_by_technician' },
  managerApproval: { approvedBy: APPROVER, approvedAt: '2026-11-19T09:00:00.000Z', managerName: 'Old Manager', managerSignature: SIG },
  reviewControls: {
    photoReviews: [{ photoId: 'p1' }],
    managerApproval: { approvedBy: APPROVER, managerName: 'Old Manager' },
  },
  fullReport: { version: 'golden-report-v1.0', reportId: WORKFLOW_ID },
  fullReportGeneratedAt: '2026-11-19T09:30:00.000Z',
}
const cleared = clearStaleManagerApproval(staleReport)
assert.equal(cleared.status, 'approved_for_customer_packet', 'packet gate status survives a re-verification')
assert.equal('managerApproval' in cleared, false, 'top-level manager approval must be cleared')
assert.equal('fullReport' in cleared, false, 'a report built on old measurements must be discarded')
assert.equal('fullReportGeneratedAt' in cleared, false, 'report generation marker must be discarded')
assert.equal('managerApproval' in cleared.reviewControls, false, 'review-controls manager approval must be cleared')
assert.deepEqual(cleared.reviewControls.photoReviews, [{ photoId: 'p1' }], 'photo reviews are preserved')
assert.equal(cleared.technicianVerification.verifiedAt, VERIFIED_AT, 'new technician verification is preserved')
assert.notEqual(cleared, staleReport, 'the helper must not mutate the stored report')

// The packet gate must validate a real signature and the approval's freshness,
// not merely the presence of non-empty columns.
const freshWorkflow = {
  id: WORKFLOW_ID,
  workspace_id: WS_ID,
  inspection_id: INSPECTION_ID,
  status: 'approved',
  approved_by: APPROVER,
  approved_at: VERIFIED_AT,
  manager_approved_by: APPROVER,
  manager_approved_at: '2026-11-20T11:00:00.000Z',
  manager_approval_name: 'Current Manager',
  manager_approval_signature: SIG,
  report: { status: 'approved_for_customer_packet', technicianVerification: { verifiedAt: VERIFIED_AT } },
}
assert.equal(hasValidManagerApproval(freshWorkflow, isTechnicianSignature), true)
assert.equal(hasValidManagerApproval({ ...freshWorkflow, manager_approval_signature: 'signed' }, isTechnicianSignature), false, 'an invalid signature must fail the gate')
assert.equal(hasValidManagerApproval({ ...freshWorkflow, manager_approved_by: null }, isTechnicianSignature), false, 'missing approver must fail')
assert.equal(hasValidManagerApproval({ ...freshWorkflow, manager_approval_name: '   ' }, isTechnicianSignature), false, 'blank approver name must fail')
assert.equal(hasValidManagerApproval({ ...freshWorkflow, manager_approved_at: 'not-a-date' }, isTechnicianSignature), false, 'invalid approval timestamp must fail')
assert.equal(
  hasValidManagerApproval({ ...freshWorkflow, report: { ...freshWorkflow.report, technicianVerification: { verifiedAt: '2026-11-20T12:00:00.000Z' } } }, isTechnicianSignature),
  false,
  'approval older than the technician verification is stale and must fail',
)

// Route wiring: the verify and photo-review actions clear approvals; the report
// and draft routes use the validating gate instead of presence-only checks.
const verify = read('../app/api/photo-estimate/verify/route.ts')
assert.match(verify, /clearStaleManagerApproval\(\{[\s\S]{0,160}workflow\.report/, 'verify must sanitize the saved report')
assert.match(verify, /manager_approved_by: null/, 'verify must clear the manager approver column')
assert.match(verify, /manager_approval_signature: null/, 'verify must clear the manager signature column')

const review = read('../app/api/photo-estimate/review/route.ts')
assert.match(review, /clearStaleManagerApproval\(workflow\.report\)/, 'a new photo review must invalidate manager approval')
assert.match(review, /manager_approved_by: null/, 'photo review must clear the manager approver column')

const report = read('../app/api/photo-estimate/report/route.ts')
assert.match(report, /hasValidManagerApproval\(row, isTechnicianSignature\)/, 'report generation must use the validating gate')
assert.ok(!/!row\.manager_approval_name \|\|/.test(report), 'report generation must not rely on presence-only checks')
assert.match(report, /status: 'approved_for_customer_packet'/, 'generating a report must preserve the packet gate status')

const draft = read('../app/api/estimates/draft/route.ts')
assert.match(draft, /hasValidManagerApproval\(workflow, isTechnicianSignature\)/, 'draft creation must use the validating gate')
assert.ok(!/!workflow\.manager_approved_by \|\|/.test(draft), 'draft creation must not rely on presence-only checks')

console.log('photo-approval-contract-test: PASS (stale approval cleared; manager gate validates signature and freshness; packet status preserved)')
