import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { buildInspectionPacket } = await import('../lib/inspection/packet.ts')
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const session = {
  id: 'inspection-1',
  workspace_id: 'workspace-1',
  lead_id: 'lead-1',
  status: 'completed',
  started_at: '2026-11-05T15:00:00.000Z',
  completed_at: '2026-11-05T16:00:00.000Z',
}

const photo = (overrides = {}) => ({
  id: 'photo-1',
  album: 'roof',
  caption: 'Front slope',
  mime_type: 'image/jpeg',
  file_size_bytes: 1024,
  width: 800,
  height: 600,
  captured_at: '2026-11-05T15:10:00.000Z',
  upload_status: 'uploaded',
  object_path: 'workspace-1/inspection-1/photo-1.jpg',
  ...overrides,
})

const measurement = (overrides = {}) => ({
  id: 'measurement-1',
  source_type: 'manual',
  confidence: 'high',
  source_reference: 'field tape',
  captured_at: '2026-11-05T15:20:00.000Z',
  roof_area_sqft: 1800,
  roof_squares: '18',
  gutter_lf: null,
  ridge_lf: null,
  eave_lf: 120,
  rake_lf: null,
  valley_lf: null,
  rafter_lf: null,
  soffit_lf: null,
  fascia_lf: null,
  pitch: '6/12',
  roof_type: 'gable',
  ...overrides,
})

const base = { inspection: session, photos: [photo()], measurements: [measurement()], agent3Output: { issue_count: 0, issues: [] }, now: '2026-11-05T17:00:00.000Z' }

// 1. Complete evidence is ready and carries no fabricated totals.
const complete = buildInspectionPacket(base)
assert.equal(complete.readyForReview, true)
assert.deepEqual(complete.blockingIssues, [])
assert.deepEqual(complete.reviewItems, [])
assert.equal(complete.photos.length, 1)
assert.equal(complete.photos[0].hasCaption, true)
assert.equal(complete.albumCounts.roof, 1)
assert.equal(complete.measurements[0].values.roof_area_sqft, 1800)
assert.equal(complete.measurements[0].values.roof_squares, 18)
assert.equal(complete.measurements[0].values.pitch, '6/12')
assert.ok(!('gutter_lf' in complete.measurements[0].values), 'missing values are omitted, not zero-filled')
assert.ok(!('total' in complete), 'packet does not invent totals')
assert.equal(complete.privacy.publicAccess, false)
assert.equal(complete.privacy.urlsIncluded, false)
assert.equal(complete.inspection.id, 'inspection-1')

// 2. No photos blocks review.
const noPhotos = buildInspectionPacket({ ...base, photos: [] })
assert.equal(noPhotos.readyForReview, false)
assert.ok(noPhotos.blockingIssues.includes('photos_present'))

// 3. Incomplete session blocks review.
const incomplete = buildInspectionPacket({ ...base, inspection: { ...session, status: 'in_progress', completed_at: null } })
assert.equal(incomplete.readyForReview, false)
assert.ok(incomplete.blockingIssues.includes('inspection_completed'))

// 4. Duplicate stored objects block review.
const duplicate = buildInspectionPacket({ ...base, photos: [photo(), photo({ id: 'photo-2', caption: 'Back slope' })] })
assert.equal(duplicate.readyForReview, false)
assert.ok(duplicate.blockingIssues.includes('unique_objects'))

// 5. Pending uploads and missing captions are review items, not silent passes.
const pending = buildInspectionPacket({ ...base, photos: [photo({ upload_status: 'uploading', caption: null })] })
assert.ok(pending.reviewItems.includes('uploads_complete'))
assert.ok(pending.reviewItems.includes('captions_present'))
assert.equal(pending.readyForReview, true, 'review items do not block, but they are visible')

// 6. Unverified measurements are flagged without changing the values.
const unverified = buildInspectionPacket({ ...base, measurements: [measurement({ confidence: 'unverified' })] })
assert.ok(unverified.reviewItems.includes('measurement_provenance'))
assert.equal(unverified.measurements[0].confidence, 'unverified')
assert.equal(unverified.measurements[0].values.roof_area_sqft, 1800)

// 7. No measurement row is reviewable, never estimated.
const noMeasurements = buildInspectionPacket({ ...base, measurements: [] })
assert.ok(noMeasurements.reviewItems.includes('measurements_present'))
assert.deepEqual(noMeasurements.measurements, [])

// 8. Agent 3 absence is stated, not invented; issues are surfaced verbatim.
const noAgent = buildInspectionPacket({ ...base, agent3Output: null })
assert.equal(noAgent.agent3.reviewed, false)
assert.ok(noAgent.reviewItems.includes('agent3_review'))
const agentIssues = buildInspectionPacket({ ...base, agent3Output: { issue_count: 1, issues: ['photo-9:missing_caption'] } })
assert.equal(agentIssues.agent3.reviewed, true)
assert.deepEqual(agentIssues.agent3.issues, ['photo-9:missing_caption'])
assert.ok(agentIssues.reviewItems.includes('agent3_review'))

// 9. Route: member scoped, no public URL, no outbound call, explicit failures.
const route = read('../app/api/inspections/[id]/packet/route.ts')
assert.ok(route.includes('workspaceId'), 'route is workspace scoped')
assert.ok(route.includes(".eq('workspace_id', workspaceId)"), 'every query filters by workspace')
assert.ok(route.includes("createSignedUrl") === false, 'route never signs URLs')
assert.ok(!/storage\.from/.test(route), 'route never builds a storage URL')
assert.ok(!/fetch\(/.test(route), 'route makes no outbound call')
assert.ok(route.includes('status: 401'), 'unauthenticated request is rejected')
assert.ok(route.includes('status: 404'), 'missing inspection is not leaked')
assert.ok(route.includes('status: 502'), 'query failures are surfaced')
assert.ok(route.includes('buildInspectionPacket'), 'route uses the deterministic builder')

// 10. Review page: short-lived member URLs, explicit unavailable state.
const page = read('../app/inspections/[id]/page.tsx')
assert.ok(page.includes('createSignedUrl(photo.objectPath, 300)'), 'preview URLs live 5 minutes')
assert.ok(page.includes("cache: 'no-store'"), 'packet request is not cached')
assert.ok(page.includes('No measurement rows'), 'missing measurements are stated')
assert.ok(page.includes('does not estimate missing values'), 'no invented measurement is promised')
assert.ok(page.includes('role="alert"'), 'errors are announced')
assert.ok(read('../app/inspections/page.tsx').includes('Review packet'), 'inspections list links to the packet')

console.log('inspection-packet-test: PASS (deterministic checklist, blockers vs review items, stated values only, private URLs, workspace-scoped route, explicit Agent 3 absence)')
