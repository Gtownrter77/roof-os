// Pure queue contracts for the single existing JARVIS queue. The database
// adapter lives in the API layer; everything here is deterministic so the
// NOT NULL hash/key and FK rules can be proven without a live database.

import { createHash } from 'node:crypto'
import type { AdjusterNote, JarvisJobType } from '../types.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

/** Deterministic serialization: key order must never change a hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function payloadHash(payload: unknown): string {
  return sha256(stableStringify(payload ?? {}))
}

/** One idempotency key per (workspace, job type, claim, payload). */
export function idempotencyKey(input: {
  workspaceId: string
  type: JarvisJobType | string
  claimId?: string | null
  payload?: unknown
}): string {
  return sha256([
    input.workspaceId,
    input.type,
    input.claimId ?? '',
    payloadHash(input.payload ?? {}),
  ].join('|'))
}

/** Explicit, stable key for an adjuster_messages row. */
export function messageIdempotencyKey(note: Pick<AdjusterNote, 'workspaceId' | 'claimId' | 'channel' | 'direction' | 'body'>): string {
  return sha256([
    note.workspaceId,
    note.claimId,
    note.channel,
    note.direction,
    payloadHash(note.body),
  ].join('|'))
}

/**
 * The exact insert shape for `jarvis_jobs`. Both NOT NULL columns are always
 * computed here; no caller may supply an empty hash or key.
 */
export function enqueueShape(input: {
  workspaceId: string
  type: JarvisJobType | string
  payload: Record<string, unknown>
  claimId?: string | null
  leadId?: string | null
  runAfter?: string
}) {
  const hash = payloadHash(input.payload)
  return {
    workspace_id: input.workspaceId,
    type: input.type,
    payload: input.payload,
    payload_hash: hash,
    idempotency_key: idempotencyKey({
      workspaceId: input.workspaceId,
      type: input.type,
      claimId: input.claimId,
      payload: input.payload,
    }),
    status: 'queued',
    attempts: 0,
    claim_id: isUuid(input.claimId) ? input.claimId : null,
    lead_id: isUuid(input.leadId) ? input.leadId : null,
    run_after: input.runAfter ?? new Date().toISOString(),
  }
}

/**
 * FK-safe values for adjuster_messages. A claim id is never copied into the
 * lead column, and unknown/malformed identities become '' rather than a
 * bogus UUID or the literal string 'unknown'.
 */
export function foreignKeysForNote(input: {
  claimId: string
  leadId?: string | null
  identityId?: string | null
}): { leadId: string; identityId: string } {
  const leadId = isUuid(input.leadId) && input.leadId !== input.claimId ? input.leadId : ''
  const identityId = input.identityId === '' || isUuid(input.identityId) ? input.identityId! : ''
  return { leadId, identityId }
}
