import { now, uuid } from './util.ts'
import type { MeasurementRecord, QAEvent, QAState } from './types.ts'

/** The one non-negotiable lock. Everything after it is defined by the job owner. */
export const LOCK_SEQUENCE = ['tech_lock'] as const

const ROLE_LOCKS: Record<string, string[]> = {
  tech_lock: ['tech', 'admin'],
  survey_control: ['surveyor', 'admin'],
}
const ACCEPT_ROLES = new Set(['tech', 'owner', 'surveyor', 'admin'])
const CORRECT_ROLES = new Set(['tech', 'admin'])
const REJECT_ROLES = new Set(['tech', 'owner', 'admin'])

export function requiredLocks(ownerLockSequence: string[]): string[] {
  return [...LOCK_SEQUENCE, ...ownerLockSequence.filter((lock) => !LOCK_SEQUENCE.includes(lock as never))]
}

function requireRole(role: string, allowed: Set<string>, action: string) {
  if (!allowed.has(role)) throw new Error(`${action} rejected: role ${role || 'unknown'} is not authorized`)
}

export type ReviewInput = {
  action: QAEvent['action']
  actorId: string
  actorRole: string
  reason?: string | null
  recordId?: string
  value?: number | null
  lock?: string
}

export function applyReviewAction(state: QAState, input: ReviewInput): QAState {
  const { action, actorId, actorRole } = input
  const reason = input.reason ?? null
  let set = state.set
  let events = state.events
  let locks = state.locks
  let version = state.version

  if (action === 'accept') {
    requireRole(actorRole, ACCEPT_ROLES, 'accept')
    if (!input.recordId) throw new Error('accept requires a recordId')
    const target = set.records.find((record) => record.id === input.recordId)
    if (!target) throw new Error('accept target record not found')
    const before = { ...target }
    const after = { ...target, status: 'accepted' as const }
    set = { ...set, records: set.records.map((record) => record.id === target.id ? after : record) }
    events = [...events, {
      id: uuid(), setId: set.id, actorId, actorRole, action, before, after, reason,
      createdAt: now(),
    }]
  } else if (action === 'correct') {
    requireRole(actorRole, CORRECT_ROLES, 'correct')
    if (!input.recordId) throw new Error('correct requires a recordId')
    if (reason === null || reason.trim() === '') throw new Error('correction requires a reason')
    const target = set.records.find((record) => record.id === input.recordId)
    if (!target) throw new Error('correction target record not found')
    const before = { ...target }
    const revised: MeasurementRecord = {
      ...target,
      id: uuid(),
      value: input.value === undefined ? target.value : input.value,
      correctionOf: target.id,
      status: 'accepted',
      reason,
    }
    set = {
      ...set,
      records: [
        ...set.records.map((record) => record.id === target.id
          ? { ...record, status: 'rejected' as const } : record),
        revised,
      ],
    }
    events = [...events, {
      id: uuid(), setId: set.id, actorId, actorRole, action, before, after: revised, reason,
      createdAt: now(),
    }]
    version += 1
  } else if (action === 'reject') {
    requireRole(actorRole, REJECT_ROLES, 'reject')
    if (!input.recordId) throw new Error('reject requires a recordId')
    const target = set.records.find((record) => record.id === input.recordId)
    if (!target) throw new Error('reject target record not found')
    const before = { ...target }
    const after = { ...target, status: 'rejected' as const }
    set = { ...set, records: set.records.map((record) => record.id === target.id ? after : record) }
    events = [...events, {
      id: uuid(), setId: set.id, actorId, actorRole, action, before, after, reason,
      createdAt: now(),
    }]
  } else if (action === 'lock') {
    if (set.status === 'relative-only') {
      throw new Error('relative-only measurement set cannot be locked or published')
    }
    const lock = input.lock
    if (!lock) throw new Error('lock requires a lock name')
    const allowed = ROLE_LOCKS[lock] ??
      ((LOCK_SEQUENCE as readonly string[]).includes(lock) ? ['tech', 'admin'] : ['owner', 'admin'])
    requireRole(actorRole, new Set(allowed), `lock ${lock}`)
    if (!requiredLocks(state.ownerLockSequence).includes(lock)) {
      throw new Error(`lock ${lock} is not part of this job's lock sequence`)
    }
    if (locks.includes(lock)) throw new Error(`lock ${lock} already satisfied`)
    locks = [...locks, lock]
    const allSatisfied = requiredLocks(state.ownerLockSequence).every((item) => locks.includes(item))
    set = {
      ...set,
      status: allSatisfied ? 'locked' : 'reviewed',
      lockedBy: allSatisfied ? actorId : null,
      lockedAt: allSatisfied ? now() : null,
    }
    events = [...events, {
      id: uuid(), setId: set.id, actorId, actorRole, action,
      before: { locks: state.locks }, after: { locks },
      reason, createdAt: now(),
    }]
  } else if (action === 'unlock') {
    requireRole(actorRole, new Set(['admin']), 'unlock')
    const lock = input.lock
    if (!lock) throw new Error('unlock requires a lock name')
    locks = locks.filter((item) => item !== lock)
    set = { ...set, status: 'reviewed', lockedBy: null, lockedAt: null }
    events = [...events, {
      id: uuid(), setId: set.id, actorId, actorRole, action,
      before: { locks: state.locks }, after: { locks }, reason, createdAt: now(),
    }]
  } else {
    throw new Error(`unknown QA action: ${action}`)
  }

  return { set, events, locks, version, ownerLockSequence: state.ownerLockSequence }
}

export function assertPublishable(state: QAState): void {
  const missing = requiredLocks(state.ownerLockSequence).filter((lock) => !state.locks.includes(lock))
  if (missing.length) throw new Error(`cannot publish: missing locks ${missing.join(', ')}`)
  if (state.set.status !== 'locked') throw new Error('cannot publish: measurement set is not locked')
  const unlinked = state.set.records.filter(
    (record) => !Array.isArray(record.sourceRefs) || record.sourceRefs.length === 0,
  )
  if (unlinked.length) {
    throw new Error(`cannot publish: ${unlinked.length} measurement record(s) lack evidence links`)
  }
}
