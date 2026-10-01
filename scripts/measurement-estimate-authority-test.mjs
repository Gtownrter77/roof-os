import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const aiRoute = read('../app/api/photo-estimate/analyze/route.ts')
const verifyRoute = read('../app/api/photo-estimate/verify/route.ts')
const manualRoute = read('../app/api/measurements/manual/route.ts')
const estimateRoute = read('../app/api/estimates/draft/route.ts')
const measurementSchema = read('../supabase/migrations/012_inspection_measurements_storms.sql')

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
assert.ok(verifyRoute.includes('verifiedBy: user.id'))
assert.ok(verifyRoute.includes("decision: 'verified_by_technician'"))
assert.ok(verifyRoute.includes('approved_by: user.id, approved_at: now'))
assert.ok(verifyRoute.includes('roof_squares: fieldSquares'))

// Ordinary manual measurement entry is explicitly unverified until reviewed.
assert.ok(manualRoute.includes("source_type: 'manual'"))
assert.ok(manualRoute.includes("confidence: 'unverified'"))
assert.ok(manualRoute.includes('Manual measurements remain unverified until reviewed.'))
assert.ok(measurementSchema.includes("confidence text not null check (confidence in ('unverified','low','medium','high','certified'))"))

// Estimate packets remain workspace-scoped, unpriced drafts with explicit human-review gates.
const memberCheck = estimateRoute.indexOf('requireWorkspaceMember(supabase, user.id, body.workspaceId)')
const packetInsert = estimateRoute.indexOf("from('estimate_review_packets').insert(")
assert.ok(estimateRoute.includes('supabase.auth.getUser()'))
assert.ok(memberCheck >= 0 && packetInsert > memberCheck)
assert.ok(estimateRoute.includes(".from('inspection_measurements').select('id,inspection_id')"))
assert.ok(estimateRoute.includes(".eq('id', body.measurementId).eq('workspace_id', body.workspaceId)"))
assert.ok(estimateRoute.includes('data.inspection_id !== body.inspectionId'))
assert.ok(estimateRoute.includes("kind: 'replacement-draft'"))
assert.ok(estimateRoute.includes("priceStatus: 'unpriced'"))
assert.equal((estimateRoute.match(/price: null/g) ?? []).length, 2, 'both draft line items have no price')
assert.ok(estimateRoute.includes("status: 'needs_price_review'"))
assert.ok(estimateRoute.includes("price_source: 'unpriced-draft'"))
assert.ok(estimateRoute.includes("'Verify measurement source and confidence'"))
assert.ok(estimateRoute.includes("'Attach approved market price book'"))
assert.ok(estimateRoute.includes("'Human approval before external use'"))
assert.ok(estimateRoute.includes('This is a review-gated unpriced draft. It is not an insurance estimate and must not be sent externally.'))
assert.ok(measurementSchema.includes('measurement_id uuid references public.inspection_measurements(id)'))

console.log('measurement-estimate-authority-test: PASS (AI-only persistence, technician approval, unverified measurement labeling, and unpriced draft gates)')
