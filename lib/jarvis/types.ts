// Types shared by the in-house JARVIS adjuster. All runtime logic stays in the
// orchestrator; these are data contracts only so they can be imported by plain
// Node gate scripts with --experimental-strip-types.

export const JARVIS_LOGICAL_AGENT_COUNT = 15

/** Six queue job types, all handled by the single existing JARVIS worker. */
export const JARVIS_JOB_TYPES = [
  'run_claim_plan',
  'update_claim_status',
  'send_message',
  'generate_document',
  'extract_estimate',
  'sandbox_action',
] as const

export type JarvisJobType = (typeof JARVIS_JOB_TYPES)[number]

/** Only these types may be queued in this deployment; the other two dispatched
 * handlers have no configured provider and are explicitly unsupported. */
export const ENQUEUEABLE_JOB_TYPES: readonly JarvisJobType[] = [
  'run_claim_plan',
  'update_claim_status',
  'send_message',
  'sandbox_action',
]

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type ClaimStatus = 'new' | 'planned' | 'contacted' | 'estimating' | 'quoted' | 'won' | 'lost' | 'cancelled'
export type Channel = 'sms' | 'email' | 'voice'

export interface JarvisJob {
  id: string
  workspaceId: string
  type: JarvisJobType
  status: JobStatus
  payload: Record<string, unknown>
  payloadHash: string
  idempotencyKey: string
  attempts: number
  claimId: string | null
  leadId: string | null
  runAfter: string
  createdAt: string
  updatedAt: string
  lastError: string | null
}

export interface ConsentRecord {
  smsConsent: boolean
  emailConsent: boolean
  voiceConsent?: boolean
  optedOutAt: string | null
}

export interface ClaimFacts {
  measurements: Array<{ value: number; unit: string; provenance: string }>
  prices: Array<{ amount: number | null; provenance: string }>
  coverage: Array<{ description: string; provenance: string }>
  xactimateCodes: Array<{ code: string; provenance: string }>
  scopeGaps?: string[]
}

export interface AdjusterNote {
  id?: string
  workspaceId: string
  claimId: string
  identityId: string
  leadId: string
  channel: Channel | 'internal'
  direction: 'inbound' | 'outbound' | 'internal'
  body: string
  consentSnapshot?: Record<string, unknown>
  idempotencyKey: string
  createdAt?: string
}
