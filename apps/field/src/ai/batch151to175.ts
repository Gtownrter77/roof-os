// Differentiators 151-175 — parity + beyond
// Offline-first, human-gated drafts only. No authoritative writes.

export type GoodBetterBestDraft = { options: { name: string; multiplier: number }[]; requiresApproval: true }
export function draftGoodBetterBest(): GoodBetterBestDraft {
  return {
    options: [
      { name: 'Good', multiplier: 1 },
      { name: 'Better', multiplier: 1.12 },
      { name: 'Best', multiplier: 1.28 },
    ],
    requiresApproval: true,
  }
}

export type PitchLaborDraft = { rate: number; requiresApproval: true }
export function draftPitchLabor(baseRate: number, pitch: number): PitchLaborDraft {
  const adder = pitch >= 10 ? 0.2 : pitch >= 8 ? 0.1 : 0
  return { rate: Math.round(baseRate * (1 + adder) * 100) / 100, requiresApproval: true }
}

export type SupplierPriceDraft = { source: string; note: string; requiresApproval: true }
export function draftSupplierPrice(supplier: string): SupplierPriceDraft {
  return { source: supplier, note: `${supplier} catalog stub — verify live pricing`, requiresApproval: true }
}

export type MaterialOrderDraft = { lines: string[]; requiresApproval: true }
export function draftMaterialOrder(itemNames: string[]): MaterialOrderDraft {
  return { lines: itemNames.slice(0, 12).map(n => `Order: ${n}`), requiresApproval: true }
}

export type ChangeOrderDraft = { reason: string; delta: number; requiresApproval: true }
export function draftChangeOrder(reason: string, delta: number): ChangeOrderDraft {
  return { reason, delta, requiresApproval: true }
}

export type PortalSummaryDraft = { text: string; requiresApproval: true }
export function draftPortalSummary(total: number, sections: string[]): PortalSummaryDraft {
  return { text: `Customer summary: ${sections.length} sections, draft total $${total.toFixed(2)}`, requiresApproval: true }
}

export type ESignReadyDraft = { ready: boolean; missing: string[]; requiresApproval: true }
export function draftESignReady(hasTotal: boolean, hasCustomer: boolean): ESignReadyDraft {
  const missing: string[] = []
  if (!hasTotal) missing.push('total')
  if (!hasCustomer) missing.push('customer')
  return { ready: missing.length === 0, missing, requiresApproval: true }
}

export type JobCostVarianceDraft = { estimate: number; actual: number; variance: number; requiresApproval: true }
export function draftJobCostVariance(estimate: number, actual: number): JobCostVarianceDraft {
  return { estimate, actual, variance: actual - estimate, requiresApproval: true }
}

export type SupplementDraft = { lines: string[]; requiresApproval: true }
export function draftSupplement(findings: string[]): SupplementDraft {
  return { lines: findings.map(f => `Supplement: ${f}`), requiresApproval: true }
}

export type WorkOrderDraft = { tasks: string[]; requiresApproval: true }
export function draftWorkOrder(sections: string[]): WorkOrderDraft {
  return { tasks: sections.map(s => `Work order task: ${s}`), requiresApproval: true }
}

export type AuditTrailDraft = { events: string[]; requiresApproval: true }
export function draftAuditTrail(actions: string[]): AuditTrailDraft {
  return { events: actions.map(a => `${new Date().toISOString()} · ${a}`), requiresApproval: true }
}

export type OfflineSyncDraft = { queued: number; requiresApproval: true }
export function draftOfflineSync(queued: number): OfflineSyncDraft {
  return { queued, requiresApproval: true }
}

export type MultiTradeFlagDraft = { trades: string[]; requiresApproval: true }
export function draftMultiTradeFlag(notes: string): MultiTradeFlagDraft {
  const trades: string[] = []
  if (/gutter/i.test(notes)) trades.push('gutters')
  if (/siding/i.test(notes)) trades.push('siding')
  if (/window/i.test(notes)) trades.push('windows')
  if (/paint/i.test(notes)) trades.push('painting')
  if (/soffit|fascia/i.test(notes)) trades.push('soffit/fascia')
  if (trades.length === 0) trades.push('roofing')
  return { trades, requiresApproval: true }
}

export type FinancingOfferDraft = { offer: string; requiresApproval: true }
export function draftFinancingOffer(total: number): FinancingOfferDraft {
  return { offer: total > 5000 ? 'Financing available — draft' : 'Cash / card', requiresApproval: true }
}

export type PaymentTermsDraft = { terms: string; requiresApproval: true }
export function draftPaymentTerms(): PaymentTermsDraft {
  return { terms: '50% deposit · 50% on completion — draft', requiresApproval: true }
}
