import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateRoofSquares, getApprovedPhotoWorkflowQuantities } from '../lib/estimates/verified-photo-workflow.mjs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const aiRoute = read('../app/api/photo-estimate/analyze/route.ts')
const verifyRoute = read('../app/api/photo-estimate/verify/route.ts')
const verifyPage = read('../app/photo-estimate/page.tsx')
const manualRoute = read('../app/api/measurements/manual/route.ts')
const estimateRoute = read('../app/api/estimates/draft/route.ts')
const measurementSchema = read('../supabase/migrations/012_inspection_measurements_storms.sql')
const workflowLinkMigration = read('../supabase/migrations/038_estimate_packet_photo_workflow_source.sql')

// D.3 observations may persist only in the dedicated AI metadata columns.
const aiUpdate = aiRoute.match(/\.update\(\{([\s\S]*?)\n\s*\}\)\s*\n\s*\.eq\('id'/)
assert.ok(aiUpdate, 'AI analysis persistence update exists')
const aiUpdatedColumns = [...aiUpdate[1].matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1])
assert.deepEqual(aiUpdatedColumns, ['ai_analysis', 'ai_analyzed_at', 'ai_model_version', 'ai_content_hash', 'updated_at'])
assert.ok(!aiUpdatedColumns.some((column) => /roof_squares|measurement|estimate|approved|price/i.test(column)))

// Technician approval is an authenticated, workspace-admin action with an audit record.
const verifyAdminCheck = verifyRoute.indexOf("supabase.rpc('is_workspace_admin'")
const verifyUpdate = verifyRoute.indexOf(".update({ status: 'approved'")
assert.ok(verifyRoute.includes('supabase.auth.getUser()'))
assert.ok(verifyAdminCheck > verifyRoute.indexOf("if (action === 'verify')"))
assert.ok(verifyUpdate > verifyAdminCheck, 'admin authorization precedes the approval write')
assert.ok(verifyRoute.includes("import { calculateRoofSquares } from '../../../../lib/estimates/verified-photo-workflow.mjs'"))
assert.ok(verifyRoute.includes('gutter_lf: verifiedGutterLf'))
assert.ok(verifyRoute.includes('gutterLf: verifiedGutterLf'))
assert.ok(verifyRoute.includes("typeof body.gutterLf !== 'number'"))
assert.ok(verifyRoute.includes('approved_by: user.id, approved_at: now'))
assert.ok(verifyRoute.includes('roof_squares: fieldSquares'))
assert.ok(verifyPage.includes('const [verifiedGutterLf, setVerifiedGutterLf] = useState(\'\')'))
assert.ok(verifyPage.includes('Technician-measured gutter length (LF; enter 0 if none)'))
assert.ok(verifyPage.includes('gutterLf: Number(verifiedGutterLf)'))
assert.ok(verifyPage.includes("if (action === 'verify' && !verifiedGutterLf.trim())"))
assert.ok(verifyPage.includes('These initial quantities are unverified candidates.'))

// The estimate API accepts no client quantity fields and uses only a consistent approved workflow.
assert.ok(estimateRoute.includes('Object.keys(body).some((key) => !allowedKeys.has(key))'))
assert.ok(estimateRoute.includes('Client-supplied quantities and unsupported fields are not accepted.'))
assert.ok(!estimateRoute.includes('body.roofSquares'))
assert.ok(!estimateRoute.includes('body.gutterLf'))
assert.ok(!estimateRoute.includes('body.measurementId'))
assert.ok(estimateRoute.includes(".from('photo_estimate_workflows')"))
assert.ok(estimateRoute.includes('getApprovedPhotoWorkflowQuantities(workflow)'))
assert.ok(estimateRoute.includes('photo_estimate_workflow_id: workflow.id'))
assert.ok(estimateRoute.includes('measurement_id: null'))
assert.ok(estimateRoute.includes("formula_version: 'approved-photo-workflow-v1'"))
assert.ok(estimateRoute.includes('if (approved.gutterLf > 0)'))
assert.ok(estimateRoute.includes("priceStatus: 'unpriced'"))
assert.equal((estimateRoute.match(/quantity: approved\.(?:roofSquares|gutterLf), price: null/g) ?? []).length, 2, 'roof and gutter drafts remain unpriced')
assert.ok(estimateRoute.includes("status: 'needs_price_review'"))
assert.ok(estimateRoute.includes("'Human approval before external use'"))
assert.ok(estimateRoute.includes('must not be sent externally'))
assert.ok(workflowLinkMigration.includes('photo_estimate_workflow_id uuid'))
assert.ok(workflowLinkMigration.includes('references public.photo_estimate_workflows(id) on delete restrict'))
assert.ok(workflowLinkMigration.includes('estimate_review_packets_photo_workflow_idx'))
assert.ok(workflowLinkMigration.includes('public.is_valid_approved_photo_estimate_packet'))
assert.ok(workflowLinkMigration.includes('estimate_review_packets_insert_approved_workflow'))

// Ordinary manual measurement entry remains explicitly unverified until reviewed.
assert.ok(manualRoute.includes("source_type: 'manual'"))
assert.ok(manualRoute.includes("confidence: 'unverified'"))
assert.ok(manualRoute.includes('Manual measurements remain unverified until reviewed.'))
assert.ok(measurementSchema.includes("confidence text not null check (confidence in ('unverified','low','medium','high','certified'))"))
assert.ok(measurementSchema.includes('measurement_id uuid references public.inspection_measurements(id)'))

// Exercise the production quantity helper: only a consistent technician approval can produce quantities.
const actorId = '11111111-1111-4111-8111-111111111111'
const approvedAt = '2026-09-30T12:00:00.000Z'
const measurement = { eaveLf: 42, rafterLf: 31, pitch: 6, wasteFactor: 0.1 }
const derived = calculateRoofSquares(measurement)
const approvedWorkflow = {
  id: '22222222-2222-4222-8222-222222222222',
  workspace_id: '33333333-3333-4333-8333-333333333333',
  inspection_id: '44444444-4444-4444-8444-444444444444',
  status: 'approved',
  roof_squares: derived.fieldSquares,
  gutter_lf: 126.75,
  approved_by: actorId,
  approved_at: approvedAt,
  report: {
    status: 'approved_for_customer_packet',
    technicianVerification: {
      ...measurement,
      ...derived,
      gutterLf: 126.75,
      verifiedBy: actorId,
      verifiedAt: approvedAt,
      decision: 'verified_by_technician',
    },
  },
}
assert.deepEqual(getApprovedPhotoWorkflowQuantities(approvedWorkflow), {
  roofSquares: derived.fieldSquares,
  gutterLf: 126.75,
  inspectionId: approvedWorkflow.inspection_id,
  approvedBy: actorId,
  approvedAt,
})
assert.equal(getApprovedPhotoWorkflowQuantities({ ...approvedWorkflow, status: 'report_review' }), null, 'unapproved workflow is rejected')
assert.equal(getApprovedPhotoWorkflowQuantities({ ...approvedWorkflow, approved_by: '55555555-5555-4555-8555-555555555555' }), null, 'approval actor must match technician verifier')
assert.equal(getApprovedPhotoWorkflowQuantities({ ...approvedWorkflow, gutter_lf: 100 }), null, 'stored gutter quantity must match the approved verification')
assert.equal(getApprovedPhotoWorkflowQuantities({ ...approvedWorkflow, approved_at: '2026-09-30T12:00:01.000Z' }), null, 'approval time must match the saved technician verification')
assert.equal(getApprovedPhotoWorkflowQuantities({ ...approvedWorkflow, report: { ...approvedWorkflow.report, status: 'photo_refresh_requested' } }), null, 'refresh-requested workflow is rejected')
assert.equal(getApprovedPhotoWorkflowQuantities({ ...approvedWorkflow, report: { ...approvedWorkflow.report, technicianVerification: { ...approvedWorkflow.report.technicianVerification, gutterLf: undefined } } }), null, 'missing technician gutter measurement is rejected')
const noGuttersWorkflow = { ...approvedWorkflow, gutter_lf: 0, report: { ...approvedWorkflow.report, technicianVerification: { ...approvedWorkflow.report.technicianVerification, gutterLf: 0 } } }
assert.equal(getApprovedPhotoWorkflowQuantities(noGuttersWorkflow)?.gutterLf, 0, 'an explicit technician-verified zero means no gutter line item')

console.log('measurement-estimate-authority-test: PASS (approved workflow required; roof/gutter quantities derived and consistency-checked; client quantities rejected; drafts remain unpriced)')
