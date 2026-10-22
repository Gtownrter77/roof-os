// Automations 76-100 — max-out stubs
// Offline-first, human-gated drafts only. No authoritative writes.

export type MissingShingleDraft = { count: number; confidence: number; requiresApproval: true }
export function draftMissingShingles(photoCount: number): MissingShingleDraft {
  return { count: Math.min(12, Math.floor(photoCount * 0.3)), confidence: 0.72, requiresApproval: true }
}

export type GranuleLossDraft = { severity: 'low' | 'med' | 'high'; requiresApproval: true }
export function draftGranuleLoss(photoCount: number): GranuleLossDraft {
  return { severity: photoCount > 6 ? 'high' : 'med', requiresApproval: true }
}

export type FlashingDamageDraft = { flagged: boolean; notes: string[]; requiresApproval: true }
export function draftFlashingDamage(): FlashingDamageDraft {
  return { flagged: true, notes: ['Possible boot or flashing issue — verify'], requiresApproval: true }
}

export type ElevationSortDraft = { albums: string[]; requiresApproval: true }
export function draftElevationSort(photoCount: number): ElevationSortDraft {
  return { albums: ['north', 'south', 'east', 'west'].slice(0, Math.min(4, photoCount)), requiresApproval: true }
}

export type PitchFromPhotoDraft = { pitch: number; confidence: number; requiresApproval: true }
export function draftPitchFromPhoto(): PitchFromPhotoDraft {
  return { pitch: 6, confidence: 0.65, requiresApproval: true }
}

export type SquaresFromPhotoDraft = { squares: number; confidence: number; requiresApproval: true }
export function draftSquaresFromPhoto(photoCount: number): SquaresFromPhotoDraft {
  return { squares: 20 + photoCount * 0.5, confidence: 0.6, requiresApproval: true }
}

export type StructuredNoteDraft = { fields: Record<string, string>; requiresApproval: true }
export function draftStructuredNote(transcript: string): StructuredNoteDraft {
  return { fields: { raw: transcript.slice(0, 200) }, requiresApproval: true }
}

export type VoiceTurnDraft = { intent: string; requiresApproval: true }
export function draftVoiceTurn(transcript: string): VoiceTurnDraft {
  return { intent: transcript.includes('square') ? 'measurement' : 'note', requiresApproval: true }
}

export type CodeRagDraft = { citations: string[]; requiresApproval: true }
export function draftCodeRag(state: string): CodeRagDraft {
  return { citations: [`${state} roof covering requirements — review`], requiresApproval: true }
}

export type SupplementLineDraft = { lines: string[]; requiresApproval: true }
export function draftSupplementLines(damage: string[]): SupplementLineDraft {
  return { lines: damage.map(d => `Supplement candidate: ${d}`), requiresApproval: true }
}

export type XactCodeDraft = { codes: string[]; requiresApproval: true }
export function draftXactCodes(): XactCodeDraft {
  return { codes: ['RFG 240', 'RFG 250'], requiresApproval: true }
}

export type PhotoToEstimateDraft = { lineCount: number; requiresApproval: true }
export function draftPhotoToEstimate(photoCount: number): PhotoToEstimateDraft {
  return { lineCount: Math.min(8, photoCount), requiresApproval: true }
}

export type MarginFloorDraft = { belowFloor: boolean; requiresApproval: true }
export function draftMarginFloor(subtotal: number, floor: number): MarginFloorDraft {
  return { belowFloor: subtotal < floor, requiresApproval: true }
}

export type TakeoffOptDraft = { wastePercent: number; requiresApproval: true }
export function draftTakeoffOpt(pitch: number): TakeoffOptDraft {
  return { wastePercent: 8 + pitch * 0.3, requiresApproval: true }
}

export type SupplierOrderDraft = { items: string[]; requiresApproval: true }
export function draftSupplierOrder(): SupplierOrderDraft {
  return { items: ['Shingles', 'Underlayment', 'Nails'], requiresApproval: true }
}

export type RouteOptDraft = { order: string[]; requiresApproval: true }
export function draftRouteOpt(stops: string[]): RouteOptDraft {
  return { order: [...stops].sort(), requiresApproval: true }
}

export type CheckinAnomalyDraft = { anomaly: boolean; reason: string; requiresApproval: true }
export function draftCheckinAnomaly(lateMinutes: number): CheckinAnomalyDraft {
  return { anomaly: lateMinutes > 15, reason: lateMinutes > 15 ? 'Late arrival' : 'On time', requiresApproval: true }
}

export type PortalSummaryDraft = { text: string; requiresApproval: true }
export function draftPortalSummary(findings: string): PortalSummaryDraft {
  return { text: `Customer summary draft: ${findings.slice(0, 160)}`, requiresApproval: true }
}

export type RedactionDraft = { safe: boolean; requiresApproval: true }
export function draftRedaction(text: string): RedactionDraft {
  return { safe: !/\d{3}-\d{2}-\d{4}/.test(text), requiresApproval: true }
}

export type AuditEventDraft = { kind: string; at: string; requiresApproval: true }
export function draftAuditEvent(kind: string): AuditEventDraft {
  return { kind, at: new Date().toISOString(), requiresApproval: true }
}

export type TranslationDraft = { english: string; requiresApproval: true }
export function draftTranslate(note: string): TranslationDraft {
  return { english: note, requiresApproval: true }
}

export type JobCompleteDraft = { missing: string[]; requiresApproval: true }
export function draftJobComplete(hasPhotos: boolean, hasMeas: boolean): JobCompleteDraft {
  const missing: string[] = []
  if (!hasPhotos) missing.push('photos')
  if (!hasMeas) missing.push('measurements')
  return { missing, requiresApproval: true }
}

export type WarrantyPackDraft = { selected: number; requiresApproval: true }
export function draftWarrantyPack(photoCount: number): WarrantyPackDraft {
  return { selected: Math.min(photoCount, 8), requiresApproval: true }
}

export type CapacityDraft = { jobs: number; requiresApproval: true }
export function draftCapacity(openJobs: number): CapacityDraft {
  return { jobs: openJobs, requiresApproval: true }
}

export type AgentProposalDraft = { next: string; requiresApproval: true }
export function draftAgentProposal(photoCount: number): AgentProposalDraft {
  return { next: photoCount > 0 ? 'Review damage severity draft' : 'Capture more photos', requiresApproval: true }
}
