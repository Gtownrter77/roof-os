// Prebuild readiness for one production job.
//
// The database owns the permit and weather decisions (migration 068), the
// deposit ledger (migration 063), the immutable handoff (migration 064), and
// the crew/material plan (migration 067). This module only combines those
// records into one deterministic checklist.
//
// A green checklist is a local computation, not proof that Gate 3 is closed.
// It never contacts a permit office, a weather provider, or a customer.

import type { DepositState } from '../estimates/acceptance.ts'
import { summarizeSchedule } from './schedule.ts'

export const PERMIT_STATUSES = ['unknown', 'not_required', 'needed', 'applied', 'issued'] as const
export type PermitStatus = (typeof PERMIT_STATUSES)[number]

export const WEATHER_DECISIONS = ['unknown', 'clear', 'hold'] as const
export type WeatherDecision = (typeof WEATHER_DECISIONS)[number]

/** A weather check older than this is stale and cannot keep the gate green. */
export const WEATHER_FRESHNESS_MS = 24 * 60 * 60 * 1000

export interface ReadinessRecord {
  permit_status: PermitStatus
  permit_reference: string
  permit_checked_at: string | null
  weather_decision: WeatherDecision
  weather_source: string
  weather_checked_at: string | null
}

export interface ReadinessJob {
  acceptance_id: string
  accepted_total: number
  scope_item_count: number
}

export interface ReadinessInput {
  job: ReadinessJob
  deposit: Pick<DepositState, 'status' | 'problem'>
  assignments: Array<{ status?: string | null; role?: string | null }>
  materials: Array<{ status?: string | null }>
  record: ReadinessRecord | null
}

export interface ReadinessCheck {
  key: 'approved_work_order' | 'deposit' | 'crew' | 'materials' | 'permit' | 'weather'
  label: string
  ready: boolean
  detail: string
}

export interface PrebuildReadiness {
  ready: boolean
  checks: ReadinessCheck[]
  blockers: string[]
  deposit_status: DepositState['status']
  permit_status: PermitStatus
  weather_decision: WeatherDecision
  weather_age_hours: number | null
  note: string
}

const UNKNOWN_RECORD: ReadinessRecord = {
  permit_status: 'unknown',
  permit_reference: '',
  permit_checked_at: null,
  weather_decision: 'unknown',
  weather_source: '',
  weather_checked_at: null,
}

function parseTime(value: string | null): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

export function describePermitStatus(status: string): string {
  switch (status) {
    case 'not_required': return 'No permit required'
    case 'needed': return 'Permit needed'
    case 'applied': return 'Permit applied'
    case 'issued': return 'Permit issued'
    default: return 'Permit not checked'
  }
}

export function describeWeatherDecision(decision: string): string {
  switch (decision) {
    case 'clear': return 'Weather clear'
    case 'hold': return 'Weather hold'
    default: return 'Weather not checked'
  }
}

/**
 * Deterministic checklist. Pass `now` in tests so freshness has no hidden clock.
 */
export function evaluatePrebuildReadiness(input: ReadinessInput, now: number = Date.now()): PrebuildReadiness {
  const record = input.record ?? UNKNOWN_RECORD
  const schedule = summarizeSchedule(input.assignments, input.materials)

  const workOrderReady = input.job.accepted_total > 0
    && input.job.scope_item_count > 0
    && typeof input.job.acceptance_id === 'string'
    && input.job.acceptance_id.length > 0

  const depositReady = (input.deposit.status === 'received' || input.deposit.status === 'waived')
    && input.deposit.problem === null

  const crewReady = schedule.assignments_active > 0 && schedule.crew_lead_assigned

  const materialsReady = schedule.materials_total > 0 && schedule.materials_needed === 0

  const permitChecked = parseTime(record.permit_checked_at) !== null
  const permitReady = permitChecked
    && (record.permit_status === 'issued' || record.permit_status === 'not_required')

  const weatherCheckedAt = parseTime(record.weather_checked_at)
  const weatherAgeMs = weatherCheckedAt === null ? null : Math.max(0, now - weatherCheckedAt)
  const weatherFresh = weatherAgeMs !== null && weatherAgeMs <= WEATHER_FRESHNESS_MS
  const weatherReady = record.weather_decision === 'clear' && weatherFresh

  const checks: ReadinessCheck[] = [
    {
      key: 'approved_work_order',
      label: 'Approved work order',
      ready: workOrderReady,
      detail: workOrderReady
        ? `${input.job.scope_item_count} approved scope line${input.job.scope_item_count === 1 ? '' : 's'} linked to one recorded acceptance.`
        : 'The job needs a recorded acceptance and at least one approved scope line.',
    },
    {
      key: 'deposit',
      label: 'Deposit',
      ready: depositReady,
      detail: depositReady
        ? `Deposit ${input.deposit.status}.`
        : `Deposit is ${input.deposit.status}; it must be received or waived, with no ledger problem.`,
    },
    {
      key: 'crew',
      label: 'Crew',
      ready: crewReady,
      detail: crewReady
        ? `${schedule.assignments_active} active assignment${schedule.assignments_active === 1 ? '' : 's'} with a crew lead.`
        : 'At least one active assignment and a crew lead are required.',
    },
    {
      key: 'materials',
      label: 'Materials',
      ready: materialsReady,
      detail: materialsReady
        ? `${schedule.materials_total} active material line${schedule.materials_total === 1 ? '' : 's'}, none still needed.`
        : `${schedule.materials_total} active line${schedule.materials_total === 1 ? '' : 's'}, ${schedule.materials_needed} still needed. Every active line must be ordered or delivered.`,
    },
    {
      key: 'permit',
      label: 'Permit',
      ready: permitReady,
      detail: permitReady
        ? `${describePermitStatus(record.permit_status)}, checked ${record.permit_checked_at}.`
        : `${describePermitStatus(record.permit_status)}. Record an owner decision of issued or not required.`,
    },
    {
      key: 'weather',
      label: 'Weather',
      ready: weatherReady,
      detail: weatherReady
        ? `${describeWeatherDecision(record.weather_decision)} within the last 24 hours.`
        : weatherAgeMs === null
          ? 'No weather decision is recorded.'
          : record.weather_decision === 'clear'
            ? 'The clear-weather decision is older than 24 hours.'
            : `${describeWeatherDecision(record.weather_decision)}. Record clear weather to continue.`,
    },
  ]

  const blockers = checks.filter((check) => !check.ready).map((check) => check.label)

  return {
    ready: blockers.length === 0,
    checks,
    blockers,
    deposit_status: input.deposit.status,
    permit_status: record.permit_status,
    weather_decision: record.weather_decision,
    weather_age_hours: weatherAgeMs === null ? null : Math.round((weatherAgeMs / 3_600_000) * 10) / 10,
    note: 'Internal prebuild checklist. It is not proof that Gate 3 is closed and does not contact a permit office, weather provider, or customer.',
  }
}
