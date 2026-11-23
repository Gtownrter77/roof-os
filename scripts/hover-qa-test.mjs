import assert from 'node:assert/strict'
import { LOCK_SEQUENCE, applyReviewAction, assertPublishable, requiredLocks } from '../lib/hover/qa.ts'

const evidence = [{ imageId: 'img-1', region: null, planeId: 'p1', modelVersion: 'recon-1' }]
const record = (id, value, unit = 'sqft', refs = evidence) => ({
  id, setId: 'set-1', type: 'facet_area', value, unit, confidence: 0.85,
  sourceRefs: refs, status: 'proposed', facetId: 'f1',
})
const baseSet = (status = 'draft') => ({
  id: 'set-1', jobId: 'job-1', workspaceId: 'ws-1', reconstructionId: 'recon-1',
  rulesetVersion: '1.0.0', status,
  records: [record('r1', 100), record('r2', null, 'Unknown')],
  confidenceSummary: { min: 0.85, mean: 0.85, count: 2 },
  lockedBy: null, lockedAt: null, createdAt: '2026-11-23T00:00:00.000Z',
})
const state = (set = baseSet(), ownerLockSequence = ['owner_final']) => ({
  set, events: [], locks: [], version: 1, ownerLockSequence,
})

assert.deepEqual(LOCK_SEQUENCE, ['tech_lock'])
assert.deepEqual(requiredLocks(['owner_final', 'survey_control']),
  ['tech_lock', 'owner_final', 'survey_control'])

const initial = state()
assert.throws(() => assertPublishable(initial), /lock/i)

const techLocked = applyReviewAction(initial, {
  action: 'lock', actorId: 'u-tech', actorRole: 'tech', lock: 'tech_lock',
})
assert.deepEqual(techLocked.locks, ['tech_lock'])
assert.throws(() => assertPublishable(techLocked), /owner_final/)

const ownerLocked = applyReviewAction(techLocked, {
  action: 'lock', actorId: 'u-owner', actorRole: 'owner', lock: 'owner_final',
})
assert.deepEqual(ownerLocked.locks, ['tech_lock', 'owner_final'])
assert.equal(ownerLocked.set.status, 'locked')
assert.equal(ownerLocked.set.lockedBy, 'u-owner')
assert.doesNotThrow(() => assertPublishable(ownerLocked))

const noEvidence = state(baseSet(), [])
const missing = {
  ...noEvidence,
  set: { ...noEvidence.set, records: [record('r3', 50, 'sqft', [])] },
}
const missingLocked = applyReviewAction(missing, {
  action: 'lock', actorId: 'u-tech', actorRole: 'tech', lock: 'tech_lock',
})
assert.throws(() => assertPublishable(missingLocked), /evidence/i)

const unknownOnly = state({
  ...baseSet(), records: [record('u1', null, 'Unknown')],
}, [])
const unknownLocked = applyReviewAction(unknownOnly, {
  action: 'lock', actorId: 'u-tech', actorRole: 'tech', lock: 'tech_lock',
})
assert.doesNotThrow(() => assertPublishable(unknownLocked), 'Unknown records must not block publish')

const corrected = applyReviewAction(techLocked, {
  action: 'correct', actorId: 'u-tech', actorRole: 'tech', recordId: 'r1',
  value: 120, reason: 're-traced facet from photo',
})
const event = corrected.events.at(-1)
assert.equal(event.action, 'correct')
assert.equal(event.reason, 're-traced facet from photo')
assert.equal(event.before.value, 100)
assert.equal(event.after.value, 120)
assert.equal(corrected.version, 2)
const original = corrected.set.records.find((item) => item.id === 'r1')
const revised = corrected.set.records.find((item) => item.correctionOf === 'r1')
assert.equal(original.status, 'rejected', 'original must be preserved')
assert.equal(revised.value, 120)
assert.notEqual(revised.id, 'r1')
assert.equal(revised.status, 'accepted')

assert.throws(() => applyReviewAction(techLocked, {
  action: 'accept', actorId: 'u-viewer', actorRole: 'viewer', recordId: 'r1',
}), /role|unauthori/i)

const relative = state(baseSet('relative-only'), [])
assert.throws(() => applyReviewAction(relative, {
  action: 'lock', actorId: 'u-tech', actorRole: 'tech', lock: 'tech_lock',
}), /relative|metric/i)

assert.throws(() => applyReviewAction(state(baseSet(), ['owner_final']), {
  action: 'lock', actorId: 'u-tech', actorRole: 'tech', lock: 'owner_final',
}), /role|owner/i, 'tech cannot satisfy an owner-defined lock')

console.log('hover-qa-test: PASS')
