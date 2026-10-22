// Next 25 AI automations (26-50)
// Offline-first, human-gated drafts only. No authoritative writes.

export type DamageSeverityDraft = {
  score: number
  level: 'low' | 'med' | 'high'
  notes: string[]
  requiresApproval: true
}

export function draftDamageSeverity(photoCount: number): DamageSeverityDraft {
  return {
    score: Math.min(0.9, 0.2 + photoCount * 0.05),
    level: photoCount > 8 ? 'high' : photoCount > 3 ? 'med' : 'low',
    notes: ['Severity draft — verify on site'],
    requiresApproval: true,
  }
}

export type PitchConfidence = {
  pitch: number
  confidence: number
  requiresApproval: true
}

export function draftPitchConfidence(pitch: number): PitchConfidence {
  return { pitch, confidence: 0.7, requiresApproval: true }
}

export type WastePrediction = {
  wastePercent: number
  requiresApproval: true
}

export function draftWaste(pitch: number, complexity: number): WastePrediction {
  return { wastePercent: 8 + pitch * 0.4 + complexity * 2, requiresApproval: true }
}

export type LaborHoursDraft = {
  hours: number
  requiresApproval: true
}

export function draftLaborHours(squares: number, pitch: number): LaborHoursDraft {
  return { hours: squares * (1.2 + (pitch >= 10 ? 0.3 : 0)), requiresApproval: true }
}

export type ChangeOrderFlag = {
  flagged: boolean
  reason: string
  requiresApproval: true
}

export function draftChangeOrder(newPhotos: number, originalSquares: number): ChangeOrderFlag {
  return {
    flagged: newPhotos > 5,
    reason: newPhotos > 5 ? 'Additional damage photos since original estimate' : 'No major drift detected',
    requiresApproval: true,
  }
}

export type InsurancePhrase = {
  phrases: string[]
  requiresApproval: true
}

export function draftInsurancePhrases(damage: string[]): InsurancePhrase {
  return {
    phrases: damage.map(d => `Observed ${d} consistent with covered peril — review for supplement`),
    requiresApproval: true,
  }
}

export type CodeUpgrade = {
  items: string[]
  requiresApproval: true
}

export function draftCodeUpgrades(state: string, roofType: string): CodeUpgrade {
  const items = ['Underlayment per local code']
  if (state === 'FL') items.push('High-wind fastening')
  if (roofType.includes('tile')) items.push('Tile underlayment upgrade')
  return { items, requiresApproval: true }
}

export type PhotoQuality = {
  pass: boolean
  issues: string[]
  requiresApproval: true
}

export function draftPhotoQuality(blurScore: number): PhotoQuality {
  return {
    pass: blurScore < 0.4,
    issues: blurScore >= 0.4 ? ['Possible blur — retake'] : [],
    requiresApproval: true,
  }
}

export type DuplicateGroup = {
  groups: number
  requiresApproval: true
}

export function draftDuplicateGroups(photoCount: number): DuplicateGroup {
  return { groups: Math.floor(photoCount / 4), requiresApproval: true }
}

export type VoiceMeasurement = {
  squares: number | null
  pitch: number | null
  requiresApproval: true
}

export function draftVoiceMeasurement(transcript: string): VoiceMeasurement {
  const sq = transcript.match(/(\d+)\s*squares?/i)
  const p = transcript.match(/(\d+)\s*[-\/]?\s*12/i)
  return {
    squares: sq ? Number(sq[1]) : null,
    pitch: p ? Number(p[1]) : null,
    requiresApproval: true,
  }
}

export type CrewMatch = {
  suggested: string
  requiresApproval: true
}

export function draftCrewMatch(jobType: string): CrewMatch {
  return { suggested: jobType.includes('steep') ? 'Steep-slope certified crew' : 'Standard crew', requiresApproval: true }
}

export type WeatherDelay = {
  risk: 'low' | 'med' | 'high'
  requiresApproval: true
}

export function draftWeatherDelay(forecastRain: boolean): WeatherDelay {
  return { risk: forecastRain ? 'high' : 'low', requiresApproval: true }
}

export type Sentiment = {
  score: number
  requiresApproval: true
}

export function draftSentiment(text: string): Sentiment {
  const urgent = /asap|urgent|now|emergency/i.test(text)
  return { score: urgent ? 0.9 : 0.4, requiresApproval: true }
}

export type ProposalNote = {
  text: string
  requiresApproval: true
}

export function draftProposalNote(customer: string, findings: string): ProposalNote {
  return { text: `Hi ${customer}, based on the inspection: ${findings.slice(0, 140)}`, requiresApproval: true }
}

export type FinancingCheck = {
  eligible: boolean
  requiresApproval: true
}

export function draftFinancingCheck(total: number): FinancingCheck {
  return { eligible: total >= 5000, requiresApproval: true }
}

export type WarrantyDraft = {
  language: string
  requiresApproval: true
}

export function draftWarranty(material: string): WarrantyDraft {
  return { language: `Workmanship warranty draft for ${material} install — review terms.`, requiresApproval: true }
}

export type SafetyList = {
  items: string[]
  requiresApproval: true
}

export function draftSafetyList(pitch: number): SafetyList {
  const items = ['Hard hats', 'Harness check']
  if (pitch >= 8) items.push('Steep-slope anchors')
  return { items, requiresApproval: true }
}

export type ToolList = {
  tools: string[]
  requiresApproval: true
}

export function draftToolList(scope: string): ToolList {
  return { tools: scope.includes('tear') ? ['Tear-off tools', 'Dump trailer'] : ['Install tools'], requiresApproval: true }
}

export type PriceAlert = {
  alert: boolean
  note: string
  requiresApproval: true
}

export function draftPriceAlert(changePercent: number): PriceAlert {
  return { alert: changePercent > 5, note: changePercent > 5 ? 'Material price moved' : 'Stable', requiresApproval: true }
}

export type LeadSource = {
  source: string
  requiresApproval: true
}

export function draftLeadSource(notes: string): LeadSource {
  if (/facebook|fb/i.test(notes)) return { source: 'Facebook', requiresApproval: true }
  if (/google/i.test(notes)) return { source: 'Google', requiresApproval: true }
  return { source: 'Unknown', requiresApproval: true }
}

export type NoShowRisk = {
  risk: number
  requiresApproval: true
}

export function draftNoShowRisk(priorMisses: number): NoShowRisk {
  return { risk: Math.min(0.8, priorMisses * 0.3), requiresApproval: true }
}

export type Upsell = {
  suggestions: string[]
  requiresApproval: true
}

export function draftUpsell(scope: string): Upsell {
  const s = ['Gutter guards']
  if (scope.includes('shingle')) s.push('Ridge vent upgrade')
  return { suggestions: s, requiresApproval: true }
}

export type Completeness = {
  missing: string[]
  requiresApproval: true
}

export function draftCompleteness(hasPhotos: boolean, hasMeasurements: boolean, hasSignature: boolean): Completeness {
  const missing: string[] = []
  if (!hasPhotos) missing.push('photos')
  if (!hasMeasurements) missing.push('measurements')
  if (!hasSignature) missing.push('technician signature')
  return { missing, requiresApproval: true }
}

export type Translation = {
  english: string
  requiresApproval: true
}

export function draftTranslation(note: string): Translation {
  return { english: note, requiresApproval: true }
}

export type DailySummary = {
  text: string
  requiresApproval: true
}

export function draftDailySummary(jobs: number, photos: number): DailySummary {
  return { text: `Daily draft: ${jobs} jobs, ${photos} photos captured.`, requiresApproval: true }
}
