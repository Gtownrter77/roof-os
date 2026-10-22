// Automations 126-150 — next batch stubs
// Offline-first, human-gated drafts only. No authoritative writes.

export type MaterialMatchDraft = { match: string; requiresApproval: true }
export function draftMaterialMatch(notes: string): MaterialMatchDraft {
  if (!notes) return { match: 'Unknown', requiresApproval: true }
  if (/architectural|arch/i.test(notes)) return { match: 'Architectural shingle', requiresApproval: true }
  if (/3-tab|three.tab/i.test(notes)) return { match: '3-tab shingle', requiresApproval: true }
  if (/metal/i.test(notes)) return { match: 'Metal', requiresApproval: true }
  if (/tile/i.test(notes)) return { match: 'Tile', requiresApproval: true }
  return { match: 'Standard', requiresApproval: true }
}

export type TearOffDraft = { needed: boolean; requiresApproval: true }
export function draftTearOff(notes: string): TearOffDraft {
  return { needed: /tear|remove/i.test(notes), requiresApproval: true }
}

export type DeckRepairDraft = { flagged: boolean; requiresApproval: true }
export function draftDeckRepair(notes: string): DeckRepairDraft {
  return { flagged: /deck|plywood|osb/i.test(notes), requiresApproval: true }
}

export type PipeBootDraft = { count: number; requiresApproval: true }
export function draftPipeBoots(notes: string): PipeBootDraft {
  if (!notes) return { count: 0, requiresApproval: true }
  const m = notes.match(/(\d+)\s*boot/i)
  if (m) return { count: Math.max(0, Number(m[1])), requiresApproval: true }
  if (/boot/i.test(notes)) return { count: 2, requiresApproval: true }
  return { count: 0, requiresApproval: true }
}

export type RidgeVentDraft = { lf: number; requiresApproval: true }
export function draftRidgeVent(squares: number): RidgeVentDraft {
  return { lf: Math.max(0, squares) * 2, requiresApproval: true }
}

export type SoffitDraft = { needed: boolean; requiresApproval: true }
export function draftSoffit(notes: string): SoffitDraft {
  return { needed: /soffit/i.test(notes), requiresApproval: true }
}

export type FasciaDraft = { needed: boolean; requiresApproval: true }
export function draftFascia(notes: string): FasciaDraft {
  return { needed: /fascia/i.test(notes), requiresApproval: true }
}

export type GutterGuardDraft = { suggest: boolean; requiresApproval: true }
export function draftGutterGuard(notes: string): GutterGuardDraft {
  return { suggest: /gutter/i.test(notes), requiresApproval: true }
}

export type SkylightFlashDraft = { action: string; requiresApproval: true }
export function draftSkylightFlash(): SkylightFlashDraft {
  return { action: 'Check skylight flashing', requiresApproval: true }
}

export type SatelliteDraft = { present: boolean; requiresApproval: true }
export function draftSatellite(notes: string): SatelliteDraft {
  return { present: /dish|satellite/i.test(notes), requiresApproval: true }
}

export type SolarDraft = { present: boolean; requiresApproval: true }
export function draftSolar(notes: string): SolarDraft {
  return { present: /solar/i.test(notes), requiresApproval: true }
}

export type ChimneyCapDraft = { needed: boolean; requiresApproval: true }
export function draftChimneyCap(): ChimneyCapDraft {
  return { needed: true, requiresApproval: true }
}

export type CricketDraft = { needed: boolean; requiresApproval: true }
export function draftCricket(pitch: number): CricketDraft {
  return { needed: pitch >= 6, requiresApproval: true }
}

export type IceBarrierDraft = { needed: boolean; requiresApproval: true }
export function draftIceBarrier(state: string): IceBarrierDraft {
  const cold = ['OH', 'PA', 'NY', 'MI', 'MN', 'WI', 'MA', 'VT', 'NH', 'ME']
  return { needed: cold.includes((state || '').toUpperCase()), requiresApproval: true }
}

export type UnderlaymentTypeDraft = { type: string; requiresApproval: true }
export function draftUnderlaymentType(pitch: number): UnderlaymentTypeDraft {
  return { type: pitch < 4 ? 'Double layer' : 'Synthetic', requiresApproval: true }
}

export type NailPatternDraft = { pattern: string; requiresApproval: true }
export function draftNailPattern(windZone: string): NailPatternDraft {
  return { pattern: windZone === 'high' ? '6-nail' : '4-nail', requiresApproval: true }
}

export type WasteFactorDraft = { percent: number; requiresApproval: true }
export function draftWasteFactor(pitch: number, complexity: number): WasteFactorDraft {
  const p = Math.max(0, pitch)
  const c = Math.max(0, complexity)
  return { percent: Math.round((10 + p * 0.5 + c) * 10) / 10, requiresApproval: true }
}

export type LaborCrewDraft = { crew: number; requiresApproval: true }
export function draftLaborCrew(squares: number): LaborCrewDraft {
  return { crew: squares > 30 ? 5 : 3, requiresApproval: true }
}

export type DurationDraft = { days: number; requiresApproval: true }
export function draftDuration(squares: number): DurationDraft {
  return { days: Math.max(1, Math.ceil(Math.max(0, squares) / 15)), requiresApproval: true }
}

export type StagingDraft = { needed: boolean; requiresApproval: true }
export function draftStaging(stories: number): StagingDraft {
  return { needed: stories >= 2, requiresApproval: true }
}

export type SafetyHarnessDraft = { required: boolean; requiresApproval: true }
export function draftSafetyHarness(pitch: number): SafetyHarnessDraft {
  return { required: pitch >= 6, requiresApproval: true }
}

export type DumpFeeDraft = { estimate: number; requiresApproval: true }
export function draftDumpFee(squares: number): DumpFeeDraft {
  return { estimate: Math.max(0, squares) * 8, requiresApproval: true }
}

export type PermitCostDraft = { estimate: number; requiresApproval: true }
export function draftPermitCost(): PermitCostDraft {
  return { estimate: 150, requiresApproval: true }
}

export type FinalWalkDraft = { items: string[]; requiresApproval: true }
export function draftFinalWalk(): FinalWalkDraft {
  return { items: ['Clean up', 'Magnet sweep', 'Customer walk'], requiresApproval: true }
}

export type ReviewRequestDraft = { text: string; requiresApproval: true }
export function draftReviewRequest(name: string): ReviewRequestDraft {
  const n = (name || 'Customer').trim() || 'Customer'
  return { text: `Hi ${n}, review request draft ready.`, requiresApproval: true }
}
