// Automations 101-125 — next batch stubs
// Offline-first, human-gated drafts only. No authoritative writes.

export type HailImpactDraft = { hits: number; confidence: number; requiresApproval: true }
export function draftHailImpacts(photoCount: number): HailImpactDraft {
  return { hits: Math.floor(photoCount * 0.4), confidence: 0.68, requiresApproval: true }
}

export type WindUpliftDraft = { risk: 'low' | 'med' | 'high'; requiresApproval: true }
export function draftWindUplift(pitch: number): WindUpliftDraft {
  return { risk: pitch >= 10 ? 'high' : 'med', requiresApproval: true }
}

export type UnderlaymentFlagDraft = { needed: boolean; requiresApproval: true }
export function draftUnderlaymentFlag(pitch: number): UnderlaymentFlagDraft {
  return { needed: pitch >= 4, requiresApproval: true }
}

export type IceDamRiskDraft = { risk: boolean; requiresApproval: true }
export function draftIceDamRisk(state: string): IceDamRiskDraft {
  return { risk: ['OH', 'PA', 'NY', 'MI'].includes(state), requiresApproval: true }
}

export type VentilationDraft = { recommendation: string; requiresApproval: true }
export function draftVentilation(squares: number): VentilationDraft {
  return { recommendation: squares > 25 ? 'Consider ridge vent upgrade' : 'Standard ridge vent', requiresApproval: true }
}

export type GutterMatchDraft = { match: boolean; requiresApproval: true }
export function draftGutterMatch(notes: string): GutterMatchDraft {
  return { match: /gutter/i.test(notes), requiresApproval: true }
}

export type SkylightFlagDraft = { present: boolean; requiresApproval: true }
export function draftSkylightFlag(notes: string): SkylightFlagDraft {
  return { present: /skylight/i.test(notes), requiresApproval: true }
}

export type ChimneyFlashDraft = { action: string; requiresApproval: true }
export function draftChimneyFlash(): ChimneyFlashDraft {
  return { action: 'Inspect chimney flashing', requiresApproval: true }
}

export type ValleyDraft = { type: string; requiresApproval: true }
export function draftValley(): ValleyDraft {
  return { type: 'Open valley preferred', requiresApproval: true }
}

export type DripEdgeDraft = { needed: boolean; requiresApproval: true }
export function draftDripEdge(): DripEdgeDraft {
  return { needed: true, requiresApproval: true }
}

export type StarterStripDraft = { needed: boolean; requiresApproval: true }
export function draftStarterStrip(): StarterStripDraft {
  return { needed: true, requiresApproval: true }
}

export type HipRidgeDraft = { lf: number; requiresApproval: true }
export function draftHipRidge(squares: number): HipRidgeDraft {
  return { lf: squares * 4, requiresApproval: true }
}

export type SteepAdderDraft = { percent: number; requiresApproval: true }
export function draftSteepAdder(pitch: number): SteepAdderDraft {
  return { percent: pitch >= 10 ? 15 : 0, requiresApproval: true }
}

export type AccessNoteDraft = { note: string; requiresApproval: true }
export function draftAccessNote(notes: string): AccessNoteDraft {
  return { note: notes.slice(0, 80) || 'Standard access', requiresApproval: true }
}

export type DumpsterDraft = { size: string; requiresApproval: true }
export function draftDumpster(squares: number): DumpsterDraft {
  return { size: squares > 30 ? '20-yard' : '10-yard', requiresApproval: true }
}

export type PermitFlagDraft = { needed: boolean; requiresApproval: true }
export function draftPermitFlag(state: string): PermitFlagDraft {
  return { needed: true, requiresApproval: true }
}

export type HOAFlagDraft = { needed: boolean; requiresApproval: true }
export function draftHOAFlag(notes: string): HOAFlagDraft {
  return { needed: /hoa/i.test(notes), requiresApproval: true }
}

export type ColorMatchDraft = { suggestion: string; requiresApproval: true }
export function draftColorMatch(): ColorMatchDraft {
  return { suggestion: 'Match existing or sample', requiresApproval: true }
}

export type WarrantyYearsDraft = { years: number; requiresApproval: true }
export function draftWarrantyYears(): WarrantyYearsDraft {
  return { years: 10, requiresApproval: true }
}

export type FollowUpDaysDraft = { days: number; requiresApproval: true }
export function draftFollowUpDays(): FollowUpDaysDraft {
  return { days: 2, requiresApproval: true }
}

export type PhotoAlbumGapDraft = { missing: string[]; requiresApproval: true }
export function draftPhotoAlbumGap(albums: string[]): PhotoAlbumGapDraft {
  const needed = ['damage', 'measurements', 'before']
  return { missing: needed.filter(a => !albums.includes(a)), requiresApproval: true }
}

export type SyncPriorityDraft = { priority: 'high' | 'normal'; requiresApproval: true }
export function draftSyncPriority(photoCount: number): SyncPriorityDraft {
  return { priority: photoCount > 10 ? 'high' : 'normal', requiresApproval: true }
}

export type CrewNoteDraft = { text: string; requiresApproval: true }
export function draftCrewNote(notes: string): CrewNoteDraft {
  return { text: notes.slice(0, 120) || 'No crew note', requiresApproval: true }
}

export type CustomerTextDraft = { body: string; requiresApproval: true }
export function draftCustomerText(name: string): CustomerTextDraft {
  return { body: `Hi ${name}, inspection draft is ready for review.`, requiresApproval: true }
}

export type OfficeHandoffDraft = { ready: boolean; requiresApproval: true }
export function draftOfficeHandoff(hasPhotos: boolean, hasNotes: boolean): OfficeHandoffDraft {
  return { ready: hasPhotos && hasNotes, requiresApproval: true }
}
