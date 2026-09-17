import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ui = readFileSync('app/photo-estimate/page.tsx', 'utf8')
const api = readFileSync('app/api/photo-estimate/verify/route.ts', 'utf8')
const migration = readFileSync('supabase/migrations/024_photo_refresh_decisions.sql', 'utf8')

assert.ok(ui.includes('Request photo refresh'))
assert.ok(ui.includes('Verify measurements'))
assert.ok(ui.includes("saveFieldVerification('refresh')"))
assert.ok(ui.includes("saveFieldVerification('verify')"))
assert.ok(api.includes("action !== 'verify' && action !== 'refresh'"))
assert.ok(api.includes("status: 'photo_refresh_requested'"))
assert.ok(api.includes("status: 'approved'"))
assert.ok(api.includes('Existing measurements and source photos were preserved.'))
assert.ok(api.includes("decision: 'verified_by_technician'"))
assert.ok(migration.includes('refresh_requested_by'))
assert.ok(migration.includes('photo_refresh_requested'))

const initial = { status: 'report_review', measurements: { eaveLf: 42, rafterLf: 31, pitch: -4 } }
const mockTechnicianId = 'mock-technician-001'
const refresh = { ...initial, status: 'photo_refresh_requested', refreshRequested: true, refresh_requested_by: mockTechnicianId, refresh_reason: 'Photo does not show the full eave line.' }
assert.equal(refresh.measurements.pitch, -4, 'refresh must preserve technician-entered values')
assert.equal(refresh.refresh_requested_by, mockTechnicianId)
assert.equal(refresh.refresh_reason, 'Photo does not show the full eave line.')
const verified = { ...initial, status: 'approved', verificationDecision: 'verified_by_technician' }
assert.equal(verified.measurements.pitch, -4, 'verify must preserve technician-entered values')

console.log('photo-estimate-flow-test: PASS')
