// Batch 1: Top 25 Improvements — Field AI Foundations (1-10)
// Offline-first, human-gated drafts. Expand existing ai/ and fieldCoach.

import type { AiInferenceAdapter, AiInferenceInput, AiInferenceResult } from './inference'
import { fieldCoach, type CoachSnapshot, type PhotoAlbum } from '../fieldCoach'

export type PhotoAiResult = {
  damageScore: number | null
  pitchEstimate: number | null
  suggestedAlbum: PhotoAlbum | null
  suggestedCaption: string | null
  condition: 'good' | 'fair' | 'poor' | 'unknown'
  observations: string[]
}

export async function analyzePhotoLocal(input: AiInferenceInput): Promise<PhotoAiResult> {
  // Stub for on-device model. Real impl would load TFLite / ONNX / local vision model.
  // Returns draft only — human must confirm.
  const caption = input.localUri ? 'Auto-analyzed roof photo' : null
  return {
    damageScore: 0.35,
    pitchEstimate: 6,
    suggestedAlbum: 'damage',
    suggestedCaption: caption,
    condition: 'fair',
    observations: ['Possible hail impact — verify on site', 'Pitch appears moderate'],
  }
}

export type VoiceCommand = {
  intent: 'start_inspection' | 'log_note' | 'log_measurement' | 'set_status' | 'unknown'
  payload: Record<string, unknown>
  transcript: string
}

export function parseVoiceTranscript(transcript: string): VoiceCommand {
  const t = transcript.toLowerCase()
  if (t.includes('start inspection') || t.includes('begin inspection')) {
    return { intent: 'start_inspection', payload: {}, transcript }
  }
  if (t.includes('squares') || t.includes('pitch') || t.includes('eave')) {
    return { intent: 'log_measurement', payload: { raw: transcript }, transcript }
  }
  if (t.includes('note') || t.includes('damage')) {
    return { intent: 'log_note', payload: { text: transcript }, transcript }
  }
  return { intent: 'unknown', payload: {}, transcript }
}

export type GoldenReportDraft = {
  deficiencies: Array<{ description: string; severity: 'low' | 'med' | 'high'; photoIds: string[] }>
  recommendedScope: string[]
  customerSummary: string
  requiresApproval: true
}

export function draftGoldenReport(input: {
  photos: PhotoAiResult[]
  notes: string
  measurements: { squares?: number; pitch?: number }
}): GoldenReportDraft {
  const defs = input.photos
    .filter(p => (p.damageScore ?? 0) > 0.2)
    .map(p => ({
      description: p.observations[0] || 'Damage observed',
      severity: (p.damageScore ?? 0) > 0.6 ? 'high' as const : 'med' as const,
      photoIds: [],
    }))
  return {
    deficiencies: defs,
    recommendedScope: ['Verify all elevations', 'Confirm measurements on site'],
    customerSummary: `Inspection draft based on ${input.photos.length} photos. ${input.notes.slice(0, 120)}`,
    requiresApproval: true,
  }
}

export type EstimateDraft = {
  lineItems: Array<{ description: string; quantity: number; unit: string; unitPrice: number }>
  subtotal: number
  marginWarning: boolean
  requiresApproval: true
}

export function draftEstimate(input: {
  squares: number
  pitch: number
  priceBook: { laborPerSquare: number; materialPerSquare: number; minMargin: number }
}): EstimateDraft {
  const labor = input.squares * input.priceBook.laborPerSquare
  const material = input.squares * input.priceBook.materialPerSquare
  const steepAdder = input.pitch >= 10 ? labor * 0.15 : 0
  const subtotal = labor + material + steepAdder
  return {
    lineItems: [
      { description: 'Labor', quantity: input.squares, unit: 'sq', unitPrice: input.priceBook.laborPerSquare },
      { description: 'Material', quantity: input.squares, unit: 'sq', unitPrice: input.priceBook.materialPerSquare },
      ...(steepAdder ? [{ description: 'Steep adder', quantity: 1, unit: 'ls', unitPrice: steepAdder }] : []),
    ],
    subtotal,
    marginWarning: subtotal < input.priceBook.minMargin,
    requiresApproval: true,
  }
}

export type SupplementDraft = {
  flags: string[]
  language: string
  evidenceRefs: string[]
  requiresApproval: true
}

export function draftSupplement(input: {
  deficiencies: string[]
  codeNotes: string[]
}): SupplementDraft {
  return {
    flags: input.codeNotes,
    language: `Based on observed damage: ${input.deficiencies.join('; ')}. Recommend review for code-compliant upgrades.`,
    evidenceRefs: [],
    requiresApproval: true,
  }
}

export type FollowUpDraft = {
  channel: 'sms' | 'email'
  body: string
  scheduledFor: string | null
  requiresApproval: true
}

export function draftFollowUp(input: {
  leadName: string
  lastAction: 'inspection' | 'quote' | 'no_response'
}): FollowUpDraft {
  const templates = {
    inspection: `Hi ${input.leadName}, thanks for the inspection today. I'll send the summary shortly.`,
    quote: `Hi ${input.leadName}, the estimate is ready for review. Let me know if you have questions.`,
    no_response: `Hi ${input.leadName}, just checking in on the proposal. Happy to walk through it.`,
  }
  return {
    channel: 'sms',
    body: templates[input.lastAction],
    scheduledFor: null,
    requiresApproval: true,
  }
}

export function scoreLead(input: {
  weatherRisk: number
  photoCondition: number
  neighborhoodCloseRate: number
}): number {
  return Math.round((input.weatherRisk * 0.4 + input.photoCondition * 0.35 + input.neighborhoodCloseRate * 0.25) * 100)
}

export type UploadTask = {
  id: string
  localUri: string
  remotePath: string
  status: 'pending' | 'uploading' | 'synced' | 'failed'
  retries: number
  progress: number
}

export function createUploadTask(localUri: string, remotePath: string): UploadTask {
  return {
    id: `up_${Date.now()}`,
    localUri,
    remotePath,
    status: 'pending',
    retries: 0,
    progress: 0,
  }
}

export function nextChecklistPrompt(input: {
  capturedAlbums: PhotoAlbum[]
  pitch: number | null
}): string {
  if (!input.capturedAlbums.includes('damage')) return 'Capture damage album next'
  if (!input.capturedAlbums.includes('measurements') && (input.pitch ?? 0) > 0) return 'Add measurement reference photos'
  if (!input.capturedAlbums.includes('before')) return 'Get before/overview elevation'
  return 'Checklist complete — ready for notes and sync'
}

export function suggestBuildingCode(input: {
  state: string
  pitch: number
}): string[] {
  const base = ['2021 IRC R905 — roof covering requirements']
  if (input.pitch >= 10) base.push('Steep slope: confirm underlayment and fastening')
  if (input.state === 'FL') base.push('Florida: high-wind zone considerations')
  return base
}

// Re-export for convenience
export { fieldCoach }
export type { CoachSnapshot, PhotoAlbum }
