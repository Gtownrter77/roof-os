// Pure API rules. Every write path is decided here before any database call,
// so a cross-workspace or uncorrelated inbound message can never be persisted.

import { isValidEmail, normalizeE164 } from '../guards.ts'

export function resolveInboundWorkspace(input: {
  claimWorkspaceId?: string | null
  webhookWorkspaceId?: string | null
}): { allowed: boolean; reason?: 'workspace_mismatch' } {
  const { claimWorkspaceId, webhookWorkspaceId } = input
  if (!claimWorkspaceId || !webhookWorkspaceId || claimWorkspaceId !== webhookWorkspaceId) {
    return { allowed: false, reason: 'workspace_mismatch' }
  }
  return { allowed: true }
}

/**
 * Correlation requires BOTH a valid sender address and a matching lead in the
 * same workspace. A phone number alone is not proof of identity.
 */
export function correlateInbound(input: {
  from: string
  matchedLead: { workspaceId: string; phone?: string | null; email?: string | null } | null
  workspaceId: string
}): boolean {
  if (!input.matchedLead || input.matchedLead.workspaceId !== input.workspaceId) return false
  const phone = normalizeE164(input.from)
  if (phone && normalizeE164(input.matchedLead.phone) === phone) return true
  const email = isValidEmail(input.from)
  if (email && isValidEmail(input.matchedLead.email) === email) return true
  return false
}

/**
 * A sender must match the lead of the specific claim being written. A lead in
 * the same workspace is not enough: otherwise lead B's message lands on claim A.
 */
export function correlateInboundToClaim(
  claimLeadId: string | null | undefined,
  matchedLead: { id?: string } | null,
): boolean {
  const matchedId = matchedLead?.id ?? null
  if (!matchedId) return false
  return (claimLeadId ?? null) === matchedId
}

/** Stop control always goes through the database RPC, never a local-only flag. */
export function disableDecision(input: {
  kind: 'claim' | 'workspace'
  workspaceId: string
  claimId?: string
}): { function: string; args: Record<string, unknown> } {
  if (input.kind === 'claim') {
    return {
      function: 'adjuster_set_claim_disabled',
      args: { p_claim_id: input.claimId, p_disabled: true },
    }
  }
  return {
    function: 'adjuster_set_workspace_enabled',
    args: { p_workspace_id: input.workspaceId, p_enabled: false },
  }
}

/** Only a confirmed delivery may use delivered wording; 'sent' is not proof. */
export function deliveryWording(status: string): 'delivered' | 'unknown' {
  return status === 'delivered' ? 'delivered' : 'unknown'
}

export function claimReadScope(workspaceId: string): { workspace_id: string } {
  return { workspace_id: workspaceId }
}
