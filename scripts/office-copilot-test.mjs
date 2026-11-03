import assert from 'node:assert/strict'
import { buildOfficeCopilotDraft } from '../workers/office-copilot.ts'

const draft = buildOfficeCopilotDraft({
  inspectionId: 'inspection-1',
  leadName: 'Jamie Smith',
  photos: [
    { id: 'photo-1', album: 'before', caption: 'Front elevation', uploadStatus: 'uploaded', objectPath: 'a/before.jpg' },
    { id: 'photo-2', album: 'damage', caption: null, uploadStatus: 'uploaded', objectPath: 'a/damage.jpg' },
    { id: 'photo-3', album: 'general', caption: 'Duplicate', uploadStatus: 'failed', objectPath: 'a/damage.jpg' },
  ],
  activity: [
    { kind: 'inspection_completed', label: 'Inspection completed', createdAt: '2026-11-03T19:00:00.000Z' },
  ],
})

assert.equal(draft.inspectionId, 'inspection-1')
assert.equal(draft.authority, 'draft_for_human_review')
assert.equal(draft.approvalState, 'pending')
assert.deepEqual(draft.missingAlbums, ['measurements'])
assert.ok(draft.deficiencies.includes('photo-2:missing_caption'))
assert.ok(draft.deficiencies.includes('photo-3:upload_status:failed'))
assert.ok(draft.deficiencies.includes('photo-3:duplicate_object_path'))
assert.match(draft.summary, /Jamie Smith/)
assert.equal(draft.activityCount, 1)
console.log('office-copilot-test: PASS')
