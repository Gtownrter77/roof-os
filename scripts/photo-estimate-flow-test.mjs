import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ui = readFileSync('app/photo-estimate/page.tsx', 'utf8')
const api = readFileSync('app/api/photo-estimate/verify/route.ts', 'utf8')
const migration = readFileSync('supabase/migrations/024_photo_refresh_decisions.sql', 'utf8')
const photoSchema = readFileSync('supabase/migrations/003_status_history_inspection_photos.sql', 'utf8')
const analysisApi = readFileSync('app/api/photo-estimate/analyze/route.ts', 'utf8')
const reviewApi = readFileSync('app/api/photo-estimate/review/route.ts', 'utf8')
const reviewMigration = readFileSync('supabase/migrations/042_golden_report_review_controls.sql', 'utf8')
const workspaceMigration = readFileSync('supabase/migrations/046_photo_estimate_workspace_integrity.sql', 'utf8')

assert.ok(ui.includes("from('inspection_sessions')"))
assert.ok(ui.includes("from('inspection_photos').insert"))
assert.ok(ui.includes('inspection_id: activeInspectionId'))
assert.ok(ui.includes('workspace_id: workspaceId'))
assert.ok(ui.includes('uploaded_by: user.id'))
assert.ok(ui.includes('ids.push(photo.id)'))
assert.ok(!ui.includes('ids.push(path)'), 'D.2 must receive photo UUIDs, not storage object paths')
assert.ok(ui.includes('photoIds: uploaded.ids, inspectionId: uploaded.inspectionId'))
assert.ok(ui.includes('${workspaceId}/${user.id}/${activeInspectionId}/${objectId}.${extension}'))
assert.ok(ui.includes('const MAX_PHOTOS = 50'))
assert.ok(ui.includes('const MAX_PHOTO_BYTES = 30 * 1024 * 1024'))
assert.ok(photoSchema.includes('inspection_id uuid not null'))
assert.ok(photoSchema.includes('object_path text not null'))
assert.ok(photoSchema.includes('mime_type text not null'))
assert.ok(ui.includes("supabase.rpc('is_workspace_admin'"))
assert.ok(analysisApi.includes("supabase.rpc('is_workspace_admin'"))
assert.ok(analysisApi.includes("if (!isAdmin) return jsonError('Workspace administrator access is required to save AI analysis.', 403)"))
assert.ok(ui.includes("async function analyzePhotos(forceRefresh = false)"))
assert.ok(ui.includes("fetch('/api/photo-estimate/analyze'"))
assert.ok(ui.includes('onClick={() => void analyzePhotos(false)}'))
assert.ok(ui.includes('onClick={() => void analyzePhotos(true)}'))
assert.ok(ui.includes('forceRefresh: true'))
assert.ok(ui.includes('AI visual observations (non-authoritative)'))
assert.ok(ui.includes('{aiAnalysis.authority_disclaimer}'))
const packetBuilder = ui.match(/async function buildPacket\(\)([\s\S]*?)\n  }\n\n  async function analyzePhotos/)
assert.ok(packetBuilder, 'packet builder stays separate from optional AI analysis')
assert.ok(!packetBuilder[1].includes('/api/photo-estimate/analyze'), 'building a packet must not automatically invoke Gemini')
assert.ok(ui.includes('Request photo refresh'))
assert.ok(ui.includes('Verify measurements'))
assert.ok(ui.includes("saveFieldVerification('refresh')"))
assert.ok(ui.includes("saveFieldVerification('verify')"))
assert.ok(api.includes("action !== 'verify' && action !== 'refresh'"))
assert.ok(api.includes("status: 'photo_refresh_requested'"))
assert.ok(api.includes("status: 'approved'"))
assert.ok(api.includes('Existing measurements and source photos were preserved.'))
assert.ok(api.includes("decision: 'verified_by_technician'"))
assert.ok(ui.includes('Technician-measured gutter length (LF; enter 0 if none)'))
assert.ok(ui.includes('gutterLf: Number(verifiedGutterLf)'))
assert.ok(ui.includes('These initial quantities are unverified candidates.'))
assert.ok(api.includes('gutter_lf: verifiedGutterLf'))
assert.ok(api.includes('gutterLf: verifiedGutterLf'))
assert.ok(migration.includes('refresh_requested_by'))
assert.ok(migration.includes('photo_refresh_requested'))
assert.ok(api.includes('technicianName?: string'))
assert.ok(api.includes('technicianSignature?: string'))
assert.ok(ui.includes('Technician signature'))
assert.ok(reviewApi.includes("body.action !== 'photo_review' && body.action !== 'manager_approve'"))
assert.ok(reviewApi.includes('Every source photo requires a usability and coverage review'))
assert.ok(reviewApi.includes('manager_approved_by: user.id'))
assert.ok(reviewApi.includes("supabase.rpc('is_workspace_admin'"))
assert.ok(reviewMigration.includes('photo_reviews jsonb'))
assert.ok(reviewMigration.includes('manager_approval_signature'))
assert.ok(reviewMigration.includes('add column if not exists'))

const initial = { status: 'report_review', measurements: { eaveLf: 42, rafterLf: 31, pitch: -4 } }
const mockTechnicianId = 'mock-technician-001'
const refresh = { ...initial, status: 'photo_refresh_requested', refreshRequested: true, refresh_requested_by: mockTechnicianId, refresh_reason: 'Photo does not show the full eave line.' }
assert.equal(refresh.measurements.pitch, -4, 'refresh must preserve technician-entered values')
assert.equal(refresh.refresh_requested_by, mockTechnicianId)
assert.equal(refresh.refresh_reason, 'Photo does not show the full eave line.')
const verified = { ...initial, status: 'approved', verificationDecision: 'verified_by_technician', gutterLf: 126.75 }
assert.equal(verified.measurements.pitch, -4, 'verify must preserve technician-entered values')
assert.equal(verified.gutterLf, 126.75, 'approved workflow carries the technician-verified gutter length')

for (const marker of [
  'enforce_photo_estimate_workspace_consistency',
  'photo_estimate_workspace_consistency',
  'Lead and photo-estimate workflow must belong to the same workspace',
  'Inspection and photo-estimate workflow must belong to the same workspace',
]) assert.ok(workspaceMigration.includes(marker), `workspace integrity guard missing: ${marker}`)

console.log('photo-estimate-flow-test: PASS')
