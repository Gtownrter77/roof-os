// Differentiators 201-225 — next layer
// Offline-first, human-gated drafts only. No authoritative writes.

export type ColorMatchDraft = { color: string; requiresApproval: true }
export function draftColorMatch(notes: string): ColorMatchDraft {
  const m = notes.match(/(charcoal|weathered wood|driftwood|slate|black|brown|gray|grey)/i)
  return { color: m ? m[1] : 'to confirm', requiresApproval: true }
}

export type ShingleWeightDraft = { weight: string; requiresApproval: true }
export function draftShingleWeight(notes: string): ShingleWeightDraft {
  return { weight: /architectural|arch/i.test(notes) ? 'laminate' : '3-tab', requiresApproval: true }
}

export type VentilationCalcDraft = { nfa: number; requiresApproval: true }
export function draftVentilationCalc(squares: number): VentilationCalcDraft {
  return { nfa: Math.round(squares * 144 / 150), requiresApproval: true }
}

export type IceDamRiskDraft = { risk: string; requiresApproval: true }
export function draftIceDamRisk(pitch: number, state: string): IceDamRiskDraft {
  const cold = ['OH', 'PA', 'NY', 'MI', 'MN'].includes(state.toUpperCase())
  return { risk: cold && pitch < 6 ? 'high' : 'low', requiresApproval: true }
}

export type AccessDifficultyDraft = { level: string; requiresApproval: true }
export function draftAccessDifficulty(stories: number, notes: string): AccessDifficultyDraft {
  if (stories >= 3 || /tight|narrow|no access/i.test(notes)) return { level: 'difficult', requiresApproval: true }
  if (stories >= 2) return { level: 'moderate', requiresApproval: true }
  return { level: 'standard', requiresApproval: true }
}

export type DumpsterSizeDraft = { yards: number; requiresApproval: true }
export function draftDumpsterSize(squares: number): DumpsterSizeDraft {
  return { yards: squares > 40 ? 30 : squares > 20 ? 20 : 10, requiresApproval: true }
}

export type MagnetSweepDraft = { needed: boolean; requiresApproval: true }
export function draftMagnetSweep(tearOff: boolean): MagnetSweepDraft {
  return { needed: tearOff, requiresApproval: true }
}

export type CustomerTextDraft = { text: string; requiresApproval: true }
export function draftCustomerTextShort(name: string, total: number): CustomerTextDraft {
  return { text: `Hi ${name}, draft estimate ready at $${total.toFixed(0)}. Review on desktop.`, requiresApproval: true }
}

export type OfficeHandoffDraft = { ready: boolean; missing: string[]; requiresApproval: true }
export function draftOfficeHandoff(photos: number, notes: string, squares: number): OfficeHandoffDraft {
  const missing: string[] = []
  if (photos < 3) missing.push('photos')
  if (!notes) missing.push('notes')
  if (!squares) missing.push('squares')
  return { ready: missing.length === 0, missing, requiresApproval: true }
}

export type PhotoQualityDraft = { score: number; requiresApproval: true }
export function draftPhotoQuality(count: number): PhotoQualityDraft {
  return { score: count >= 8 ? 90 : count >= 4 ? 70 : 40, requiresApproval: true }
}

export type DamageSeverityDraft = { severity: string; requiresApproval: true }
export function draftDamageSeverity(notes: string): DamageSeverityDraft {
  if (/severe|total|collapse/i.test(notes)) return { severity: 'severe', requiresApproval: true }
  if (/moderate|multiple/i.test(notes)) return { severity: 'moderate', requiresApproval: true }
  return { severity: 'light', requiresApproval: true }
}

export type HailImpactDraft = { count: number; requiresApproval: true }
export function draftHailImpactCount(notes: string): HailImpactDraft {
  const m = notes.match(/(\d+)\s*hail/i)
  return { count: m ? Number(m[1]) : /hail/i.test(notes) ? 5 : 0, requiresApproval: true }
}

export type WindUpliftDraft = { risk: string; requiresApproval: true }
export function draftWindUpliftRisk(pitch: number): WindUpliftDraft {
  return { risk: pitch >= 8 ? 'elevated' : 'standard', requiresApproval: true }
}

export type AlbumGapDraft = { missing: string[]; requiresApproval: true }
export function draftAlbumGaps(albums: string[]): AlbumGapDraft {
  const expected = ['before', 'damage', 'measurements']
  return { missing: expected.filter(e => !albums.includes(e)), requiresApproval: true }
}

export type StructuredNotesDraft = { fields: Record<string, string>; requiresApproval: true }
export function draftStructuredNotes(notes: string): StructuredNotesDraft {
  return {
    fields: {
      material: /arch/i.test(notes) ? 'architectural' : 'unknown',
      damage: /hail|wind|leak/i.test(notes) ? 'noted' : 'none',
    },
    requiresApproval: true,
  }
}

export type PriceBookMatchDraft = { matched: boolean; item: string; requiresApproval: true }
export function draftPriceBookMatch(name: string): PriceBookMatchDraft {
  return { matched: name.length > 0, item: name, requiresApproval: true }
}

export type LaborHoursDraft = { hours: number; requiresApproval: true }
export function draftLaborHours(squares: number, crew: number): LaborHoursDraft {
  return { hours: Math.max(4, Math.round(squares * 1.5 / Math.max(1, crew))), requiresApproval: true }
}

export type MaterialLeadTimeDraft = { days: number; requiresApproval: true }
export function draftMaterialLeadTime(supplier: string): MaterialLeadTimeDraft {
  return { days: /abc|srs|qxo/i.test(supplier) ? 2 : 5, requiresApproval: true }
}

export type SafetyChecklistDraft = { items: string[]; requiresApproval: true }
export function draftSafetyChecklist(pitch: number): SafetyChecklistDraft {
  const items = ['Hard hats', 'Gloves']
  if (pitch >= 6) items.push('Harness')
  return { items, requiresApproval: true }
}

export type CleanupDraft = { tasks: string[]; requiresApproval: true }
export function draftCleanup(): CleanupDraft {
  return { tasks: ['Magnet sweep', 'Debris haul', 'Customer walk'], requiresApproval: true }
}

export type WarrantyRegistrationDraft = { needed: boolean; requiresApproval: true }
export function draftWarrantyRegistration(years: number): WarrantyRegistrationDraft {
  return { needed: years >= 25, requiresApproval: true }
}

export type ReferralAskDraft = { text: string; requiresApproval: true }
export function draftReferralAsk(name: string): ReferralAskDraft {
  return { text: `Hi ${name}, know anyone else who needs a roof? — draft`, requiresApproval: true }
}

export type UpsellDraft = { suggestions: string[]; requiresApproval: true }
export function draftUpsell(notes: string): UpsellDraft {
  const suggestions: string[] = []
  if (/gutter/i.test(notes)) suggestions.push('Gutter guards')
  if (/siding/i.test(notes)) suggestions.push('Siding refresh')
  if (suggestions.length === 0) suggestions.push('Ridge vent upgrade')
  return { suggestions, requiresApproval: true }
}

export type CompetitiveNoteDraft = { note: string; requiresApproval: true }
export function draftCompetitiveNote(): CompetitiveNoteDraft {
  return { note: 'Multi-trade AI prefill + human gate — not available in AccuLynx / JobNimbus / Roofr', requiresApproval: true }
}
