/**
 * Optional CapOut adapter — disabled by default and review-only.
 *
 * This module does not import a network client, read a credential value, or
 * send anything. It exists so a future, separately authorized integration has
 * one explicit boundary. Enabling the flag only allows a candidate payload to
 * be built for study; submission stays off.
 *
 * No ESX generation and no ESX parity are claimed here.
 */
import type { ReviewPacket } from './types'

export interface CapoutAdapterStatus {
  provider: 'capout'
  enabled: boolean
  requested: boolean
  reason: string
  endpoint_configured: boolean
  credentials_configured: boolean
  submission_allowed: false
  esx_compatible: false
  external_submission: false
  supported: string[]
  unsupported: string[]
}

export const CAPOUT_UNSUPPORTED = [
  'esx_generation',
  'insurer_submission',
  'pricing_lookup',
  'claim_approval',
  'carrier_writeback',
]

export function capoutAdapterStatus(env: Record<string, string | undefined> = process.env): CapoutAdapterStatus {
  const requested = env.AGENT5_CAPOUT_ADAPTER === 'enabled'
  const endpointConfigured = typeof env.CAPOUT_API_BASE_URL === 'string' && env.CAPOUT_API_BASE_URL.length > 0
  const credentialsConfigured = typeof env.CAPOUT_API_KEY === 'string' && env.CAPOUT_API_KEY.length > 0
  const enabled = requested && endpointConfigured && credentialsConfigured

  let reason = 'disabled_by_default'
  if (requested && !endpointConfigured) reason = 'enabled_but_endpoint_missing'
  else if (requested && !credentialsConfigured) reason = 'enabled_but_credentials_missing'
  else if (enabled) reason = 'candidate_mapping_only_no_submission'

  return {
    provider: 'capout',
    enabled,
    requested,
    reason,
    endpoint_configured: endpointConfigured,
    credentials_configured: credentialsConfigured,
    submission_allowed: false,
    esx_compatible: false,
    external_submission: false,
    supported: ['review_packet_candidate_json'],
    unsupported: [...CAPOUT_UNSUPPORTED],
  }
}

export interface CapoutCandidate {
  provider: 'capout'
  adapter_enabled: boolean
  submission_allowed: false
  esx_compatible: false
  external_submission: false
  document_id: string
  lines: Array<{
    item_code: string | null
    description: string
    quantity: number | null
    unit: string | null
    unit_cost: number | null
    enabled: boolean
  }>
  totals: ReviewPacket['totals']
  unsupported: string[]
  note: string
}

/**
 * Builds a candidate payload for study or a future authorized adapter. It never
 * invents a price and never emits an ESX structure.
 */
export function buildCapoutCandidate(
  packet: ReviewPacket,
  status: CapoutAdapterStatus = capoutAdapterStatus(),
): CapoutCandidate {
  return {
    provider: 'capout',
    adapter_enabled: status.enabled,
    submission_allowed: false,
    esx_compatible: false,
    external_submission: false,
    document_id: packet.document_id,
    lines: packet.lines.map((line) => ({
      item_code: line.item_code,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_cost: line.unit_cost,
      enabled: line.enabled,
    })),
    totals: packet.totals,
    unsupported: [...CAPOUT_UNSUPPORTED],
    note: 'Candidate mapping only. No ESX generation, no insurer submission, no pricing lookup.',
  }
}
