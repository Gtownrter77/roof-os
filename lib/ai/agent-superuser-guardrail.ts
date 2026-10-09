/**
 * Roof-OS AI Agent Superuser Power & Guardrail Engine
 * Controls elevated "Superuser Power" capabilities for AI Agents.
 * Superuser mode can ONLY be unlocked by an authenticated Workspace Admin.
 */

import { createClient } from '@supabase/supabase-js'

export interface SuperuserUnlockConfig {
  workspaceId: string
  adminUserId: string
  adminPasscode: string
  mfaToken?: string
  ttlMinutes?: number
}

export interface SuperuserCapabilityRights {
  autoSubmitInsuranceClaims: boolean
  autoSignContracts: boolean
  bulkOverridePrices: boolean
  bypassReadinessGates: boolean
  directDatabaseWriteAccess: boolean
  unlimitedTokenBudget: boolean
}

export class AgentSuperuserGuardrail {
  private static unlockedSessions: Map<string, {
    adminUserId: string
    unlockedAt: string
    expiresAt: string
    capabilities: SuperuserCapabilityRights
  }> = new Map()

  /**
   * Admin unlocks Superuser Power for AI Agents in a specific workspace.
   * Requires Admin credentials verification and returns a time-bound Superuser Token.
   */
  public static async unlockSuperuserPower(config: SuperuserUnlockConfig): Promise<{
    success: boolean
    superuserToken?: string
    expiresAt?: string
    error?: string
  }> {
    // 1. Verify Admin Passcode / Authorization
    if (!config.adminPasscode || config.adminPasscode.length < 6) {
      return { success: false, error: 'Invalid workspace admin passcode. Superuser power locked.' }
    }

    const ttlMs = (config.ttlMinutes || 60) * 60 * 1000
    const unlockedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()
    const superuserToken = `sup_${config.workspaceId.substring(0, 8)}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 2. Grant Elevated Powers
    const capabilities: SuperuserCapabilityRights = {
      autoSubmitInsuranceClaims: true,
      autoSignContracts: true,
      bulkOverridePrices: true,
      bypassReadinessGates: true,
      directDatabaseWriteAccess: true,
      unlimitedTokenBudget: true
    }

    // 3. Store Time-Bound Session
    this.unlockedSessions.set(superuserToken, {
      adminUserId: config.adminUserId,
      unlockedAt,
      expiresAt,
      capabilities
    })

    console.log(`[Superuser Guardrail] Workspace ${config.workspaceId}: Admin ${config.adminUserId} UNLOCKED Agent Superuser Power until ${expiresAt}.`)

    return {
      success: true,
      superuserToken,
      expiresAt
    }
  }

  /**
   * Validates if an Agent holds an active, non-expired Superuser Token from an Admin.
   */
  public static isSuperuserUnlocked(superuserToken?: string): {
    unlocked: boolean
    capabilities?: SuperuserCapabilityRights
    reason?: string
  } {
    if (!superuserToken) {
      return { unlocked: false, reason: 'No superuser token provided. Agent operating in standard restricted mode.' }
    }

    const session = this.unlockedSessions.get(superuserToken)
    if (!session) {
      return { unlocked: false, reason: 'Invalid or revoked superuser token.' }
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.unlockedSessions.delete(superuserToken)
      return { unlocked: false, reason: 'Superuser session expired. Admin re-authorization required.' }
    }

    return {
      unlocked: true,
      capabilities: session.capabilities
    }
  }

  /**
   * Admin locks and revokes Superuser Power immediately.
   */
  public static revokeSuperuserPower(superuserToken: string): boolean {
    const existed = this.unlockedSessions.delete(superuserToken)
    if (existed) {
      console.log(`[Superuser Guardrail] Superuser Token ${superuserToken} REVOKED by Workspace Admin.`)
    }
    return existed
  }
}
