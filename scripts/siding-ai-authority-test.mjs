import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const aiRoute = readFileSync('app/api/siding/analyze/route.ts', 'utf8')
const verifyRoute = readFileSync('app/api/siding/verify/route.ts', 'utf8')
const draftRoute = readFileSync('app/api/estimates/siding-draft/route.ts', 'utf8')

assert.ok(aiRoute.includes('ai_observation'), 'AI route persists dedicated AI observation')
assert.ok(aiRoute.includes("existing?.status==='unverified'"), 'AI refresh cannot overwrite verified siding measurements')
assert.ok(aiRoute.includes('ai_model_version'), 'AI route persists model metadata')
assert.ok(aiRoute.includes('ai_content_hash'), 'AI route persists content hash')
assert.ok(!aiRoute.includes('course_count: observation.course_count'), 'AI route must not write authoritative course count')
assert.ok(!aiRoute.includes('exposure_inches: observation.exposure_inches'), 'AI route must not write authoritative exposure')
assert.ok(!aiRoute.includes('width_ft: observation.wall_width_ft'), 'AI route must not write authoritative width')
assert.ok(verifyRoute.includes('is_workspace_admin'), 'verification is workspace-admin gated')
assert.ok(verifyRoute.includes("status: 'verified'"), 'verification writes verified status')
assert.ok(verifyRoute.includes('calculateSidingMeasurement'), 'verification recalculates server-side')
assert.ok(draftRoute.includes('getApprovedSidingMeasurementQuantity'), 'estimate draft consumes only approved siding authority')
assert.ok(draftRoute.includes('SIDING-REPLACE'), 'estimate draft creates siding line item')
console.log('siding AI authority regression: PASS')
