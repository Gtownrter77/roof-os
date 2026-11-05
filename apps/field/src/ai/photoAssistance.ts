export const AI_REQUEST_RETENTION_DAYS = [7, 30, 90] as const
export type AiRequestRetentionDays = typeof AI_REQUEST_RETENTION_DAYS[number]

export type FieldAiPreferences = {
  photoCaptionAlbumEnabled: boolean
  photoCompletenessEnabled: boolean
  requestRetentionDays: AiRequestRetentionDays
}

export const DEFAULT_FIELD_AI_PREFERENCES: FieldAiPreferences = {
  photoCaptionAlbumEnabled: false,
  photoCompletenessEnabled: false,
  requestRetentionDays: 7,
}

export type FieldAiFeature = 'caption_album' | 'photo_completeness'
export type FieldAiRequestStatus = 'waiting_for_upload' | 'pending_analysis' | 'completed' | 'failed'

export type PhotoEvidencePrompt = {
  album: 'general' | 'before' | 'damage' | 'measurements'
  title: string
  prompt: string
  conditional: boolean
}

export function parseFieldAiPreferences(raw: string | null | undefined): FieldAiPreferences {
  if (!raw) return { ...DEFAULT_FIELD_AI_PREFERENCES }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const retention = AI_REQUEST_RETENTION_DAYS.includes(parsed.requestRetentionDays as AiRequestRetentionDays)
      ? parsed.requestRetentionDays as AiRequestRetentionDays
      : DEFAULT_FIELD_AI_PREFERENCES.requestRetentionDays
    return {
      photoCaptionAlbumEnabled: parsed.photoCaptionAlbumEnabled === true,
      photoCompletenessEnabled: parsed.photoCompletenessEnabled === true,
      requestRetentionDays: retention,
    }
  } catch {
    return { ...DEFAULT_FIELD_AI_PREFERENCES }
  }
}

export function serializeFieldAiPreferences(preferences: FieldAiPreferences): string {
  return JSON.stringify(parseFieldAiPreferences(JSON.stringify(preferences)))
}

export function aiRequestExpiry(now: string, retentionDays: AiRequestRetentionDays): string {
  const instant = Date.parse(now)
  if (!Number.isFinite(instant)) throw new Error('A valid request timestamp is required.')
  return new Date(instant + retentionDays * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * A local album checklist only. It does not inspect images, determine damage,
 * or certify that an inspection is complete. Conditional prompts must remain
 * conditional until a technician confirms the evidence need.
 */
export function photoEvidencePrompts(albums: readonly string[], hasMeasurements: boolean): PhotoEvidencePrompt[] {
  const present = new Set(albums.map((album) => album.trim().toLowerCase()))
  const prompts: PhotoEvidencePrompt[] = []
  if (!present.has('general')) prompts.push({
    album: 'general',
    title: 'Property overview',
    prompt: 'Capture a wide view that helps the office orient to the property.',
    conditional: false,
  })
  if (!present.has('before')) prompts.push({
    album: 'before',
    title: 'Existing condition',
    prompt: 'Capture the visible roof condition before any work begins.',
    conditional: false,
  })
  if (!present.has('damage')) prompts.push({
    album: 'damage',
    title: 'Close-up details',
    prompt: 'If a concern is visible, capture a clear close-up and a wider context view.',
    conditional: true,
  })
  if (hasMeasurements && !present.has('measurements')) prompts.push({
    album: 'measurements',
    title: 'Measurement reference',
    prompt: 'If useful, add a photo showing the reference point for manual measurements.',
    conditional: true,
  })
  return prompts
}

export function photoAiRequestStatusLabel(
  status: FieldAiRequestStatus | null | undefined,
  modelAvailable = false,
): string | null {
  if (!status) return null
  if (status === 'waiting_for_upload') return 'AI request waiting for photo upload'
  if (status === 'pending_analysis') {
    return modelAvailable
      ? 'AI analysis queued'
      : 'Pending analysis · no local AI model is available in this build'
  }
  if (status === 'completed') return 'AI suggestion ready for technician review'
  return 'AI request needs attention · no result was saved'
}
