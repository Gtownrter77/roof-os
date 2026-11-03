import assert from 'node:assert/strict'
import { normalizeEmail, normalizePhone, planIntakeRouter } from '../workers/intake-router.ts'

assert.equal(normalizeEmail('  Jamie@Example.COM '), 'jamie@example.com')
assert.equal(normalizePhone('(404) 555-0123'), '+14045550123')
assert.equal(normalizePhone('not-a-phone'), null)

const duplicatePlan = planIntakeRouter({
  lead: {
    id: 'lead-1',
    name: 'Jamie Smith',
    address: '123 Main Street',
    phone: '(404) 555-0123',
    email: 'Jamie@Example.com',
    ownerId: null,
  },
  existingLeads: [
    { id: 'lead-2', name: 'J. Smith', address: '123 main street', phone: '+14045550123', email: 'jamie@example.com', ownerId: 'owner-2' },
  ],
  roundRobinOwnerIds: ['owner-1', 'owner-2'],
  taskCreatorId: 'owner-1',
  now: '2026-11-03T20:00:00.000Z',
})
assert.deepEqual(duplicatePlan.normalized, { phone: '+14045550123', email: 'jamie@example.com', address: '123 main street' })
assert.deepEqual(duplicatePlan.duplicateLeadIds, ['lead-2'])
assert.equal(duplicatePlan.actions[0].kind, 'create_review_task')
assert.match(duplicatePlan.actions[0].payload.title, /duplicate/i)

const cleanPlan = planIntakeRouter({
  lead: { id: 'lead-3', name: 'Taylor Jones', address: '9 Oak Road', phone: '4045550199', email: null, ownerId: null },
  existingLeads: [],
  roundRobinOwnerIds: ['owner-1', 'owner-2'],
  taskCreatorId: 'owner-1',
  now: '2026-11-03T20:00:00.000Z',
})
assert.equal(cleanPlan.duplicateLeadIds.length, 0)
assert.equal(cleanPlan.suggestedOwnerId, 'owner-1')
assert.equal(cleanPlan.actions[0].kind, 'assign_owner')
assert.equal(cleanPlan.actions[1].kind, 'create_task')
assert.equal(cleanPlan.actions[1].payload.dueAt, '2026-11-04T20:00:00.000Z')
console.log('intake-router-test: PASS')
