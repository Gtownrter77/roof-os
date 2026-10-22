// Differentiators 176-200 — close remaining gaps
// Offline-first, human-gated drafts only. No authoritative writes.

export type JobCostDraft = { estimate: number; materials: number; labor: number; other: number; profit: number; requiresApproval: true }
export function draftJobCost(estimate: number, materials: number, labor: number, other: number): JobCostDraft {
  return { estimate, materials, labor, other, profit: estimate - (materials + labor + other), requiresApproval: true }
}

export type SupplementLineDraft = { lines: { name: string; qty: number; unit: string; price: number }[]; requiresApproval: true }
export function draftSupplementLines(findings: string[]): SupplementLineDraft {
  return {
    lines: findings.map(f => ({ name: f, qty: 1, unit: 'ea', price: 0 })),
    requiresApproval: true,
  }
}

export type WorkOrderTaskDraft = { tasks: { trade: string; description: string; status: string }[]; requiresApproval: true }
export function draftWorkOrderTasks(sections: string[]): WorkOrderTaskDraft {
  return {
    tasks: sections.map(s => ({ trade: s, description: `Complete ${s}`, status: 'pending' })),
    requiresApproval: true,
  }
}

export type ProductionDayDraft = { date: string; crew: number; notes: string; requiresApproval: true }
export function draftProductionDay(date: string, crew: number, notes: string): ProductionDayDraft {
  return { date, crew, notes, requiresApproval: true }
}

export type CustomerPortalDraft = { url: string; sections: string[]; requiresApproval: true }
export function draftCustomerPortal(jobId: string, sections: string[]): CustomerPortalDraft {
  return { url: `https://roof-os.example/portal/${jobId}`, sections, requiresApproval: true }
}

export type AutomationTriggerDraft = { trigger: string; action: string; requiresApproval: true }
export function draftAutomationTrigger(trigger: string, action: string): AutomationTriggerDraft {
  return { trigger, action, requiresApproval: true }
}

export type BrandedProposalDraft = { title: string; options: string[]; requiresApproval: true }
export function draftBrandedProposal(title: string, options: string[]): BrandedProposalDraft {
  return { title, options, requiresApproval: true }
}

export type PhotoAnnotationDraft = { photoId: string; note: string; requiresApproval: true }
export function draftPhotoAnnotation(photoId: string, note: string): PhotoAnnotationDraft {
  return { photoId, note, requiresApproval: true }
}

export type MarginFloorDraft = { current: number; floor: number; ok: boolean; requiresApproval: true }
export function draftMarginFloor(current: number, floor: number): MarginFloorDraft {
  return { current, floor, ok: current >= floor, requiresApproval: true }
}

export type WasteOverrideDraft = { defaultPct: number; overridePct: number; requiresApproval: true }
export function draftWasteOverride(defaultPct: number, overridePct: number): WasteOverrideDraft {
  return { defaultPct, overridePct, requiresApproval: true }
}

export type TaxExemptDraft = { exempt: boolean; reason: string; requiresApproval: true }
export function draftTaxExempt(exempt: boolean, reason: string): TaxExemptDraft {
  return { exempt, reason, requiresApproval: true }
}

export type DiscountDraft = { type: string; value: number; requiresApproval: true }
export function draftDiscount(type: string, value: number): DiscountDraft {
  return { type, value, requiresApproval: true }
}

export type WarrantyDraft = { years: number; coverage: string; requiresApproval: true }
export function draftWarranty(years: number): WarrantyDraft {
  return { years, coverage: years >= 25 ? 'Lifetime limited' : `${years} year`, requiresApproval: true }
}

export type InsuranceClaimDraft = { claimNumber: string; status: string; requiresApproval: true }
export function draftInsuranceClaim(claimNumber: string): InsuranceClaimDraft {
  return { claimNumber, status: 'draft', requiresApproval: true }
}

export type PermitStatusDraft = { required: boolean; status: string; requiresApproval: true }
export function draftPermitStatus(required: boolean): PermitStatusDraft {
  return { required, status: required ? 'pending' : 'not required', requiresApproval: true }
}

export type CrewScheduleDraft = { crew: string; start: string; days: number; requiresApproval: true }
export function draftCrewSchedule(crew: string, start: string, days: number): CrewScheduleDraft {
  return { crew, start, days, requiresApproval: true }
}

export type MaterialDeliveryDraft = { supplier: string; date: string; items: string[]; requiresApproval: true }
export function draftMaterialDelivery(supplier: string, date: string, items: string[]): MaterialDeliveryDraft {
  return { supplier, date, items, requiresApproval: true }
}

export type ChangeOrderReasonDraft = { reason: string; impact: string; requiresApproval: true }
export function draftChangeOrderReason(reason: string): ChangeOrderReasonDraft {
  return { reason, impact: 'price and schedule', requiresApproval: true }
}

export type CustomerApprovalDraft = { approved: boolean; method: string; requiresApproval: true }
export function draftCustomerApproval(approved: boolean, method: string): CustomerApprovalDraft {
  return { approved, method, requiresApproval: true }
}

export type FinalInvoiceDraft = { total: number; paid: number; balance: number; requiresApproval: true }
export function draftFinalInvoice(total: number, paid: number): FinalInvoiceDraft {
  return { total, paid, balance: total - paid, requiresApproval: true }
}

export type ReviewRequestDraft = { channel: string; text: string; requiresApproval: true }
export function draftReviewRequestChannel(channel: string, name: string): ReviewRequestDraft {
  return { channel, text: `Hi ${name}, please leave a review — draft`, requiresApproval: true }
}

export type FollowUpDraft = { days: number; note: string; requiresApproval: true }
export function draftFollowUp(days: number, note: string): FollowUpDraft {
  return { days, note, requiresApproval: true }
}

export type LeadScoreDraft = { score: number; reason: string; requiresApproval: true }
export function draftLeadScore(notes: string): LeadScoreDraft {
  const score = /storm|hail|leak/i.test(notes) ? 85 : 50
  return { score, reason: score > 70 ? 'storm language' : 'standard', requiresApproval: true }
}

export type NextActionDraft = { action: string; requiresApproval: true }
export function draftNextAction(status: string): NextActionDraft {
  const map: Record<string, string> = {
    inspected: 'Send estimate',
    estimated: 'Follow up',
    sold: 'Schedule production',
    complete: 'Request review',
  }
  return { action: map[status] || 'Review job', requiresApproval: true }
}

export type CompletenessDraft = { missing: string[]; requiresApproval: true }
export function draftCompleteness(photos: number, notes: string, squares: number): CompletenessDraft {
  const missing: string[] = []
  if (photos < 5) missing.push('photos')
  if (!notes) missing.push('notes')
  if (!squares) missing.push('squares')
  return { missing, requiresApproval: true }
}
