// PostgREST returns snake_case rows. The JARVIS runtime consumes camelCase
// contracts. Mapping is explicit and strict: a malformed row fails closed
// instead of silently becoming a job with an undefined claim id.

import { JARVIS_JOB_TYPES, type JarvisJob, type JarvisJobType, type JobStatus } from '../types.ts'

const STATUSES: readonly JobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'cancelled']

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw Object.assign(new Error(`jarvis_jobs row is missing ${key}`), { code: 'adjuster_error' })
  }
  return value
}

function nullableId(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  if (value === null || value === undefined || value === '') return null
  return requiredString(row, key)
}

export function mapJobRow(row: Record<string, unknown>): JarvisJob {
  const type = requiredString(row, 'type')
  if (!JARVIS_JOB_TYPES.includes(type as JarvisJobType)) {
    throw Object.assign(new Error(`unknown job type in row: ${type}`), { code: 'adjuster_error' })
  }
  const status = requiredString(row, 'status')
  if (!STATUSES.includes(status as JobStatus)) {
    throw Object.assign(new Error(`unknown job status in row: ${status}`), { code: 'adjuster_error' })
  }
  const payload = row.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('jarvis_jobs row has no payload object'), { code: 'adjuster_error' })
  }
  const attempts = row.attempts
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) {
    throw Object.assign(new Error('jarvis_jobs row has an invalid attempt count'), { code: 'adjuster_error' })
  }
  return {
    id: requiredString(row, 'id'),
    workspaceId: requiredString(row, 'workspace_id'),
    type: type as JarvisJobType,
    status: status as JobStatus,
    payload: payload as Record<string, unknown>,
    payloadHash: requiredString(row, 'payload_hash'),
    idempotencyKey: requiredString(row, 'idempotency_key'),
    attempts,
    claimId: nullableId(row, 'claim_id'),
    leadId: nullableId(row, 'lead_id'),
    runAfter: requiredString(row, 'run_after'),
    createdAt: requiredString(row, 'created_at'),
    updatedAt: requiredString(row, 'updated_at'),
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
  }
}
