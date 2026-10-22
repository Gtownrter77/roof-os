// Photo → report engine.
// Client-safe. Drafts only. Quantities never become estimate numbers
// until the verified-photo workflow is approved.

export type PhotoDraft = {
  id: string
  elevation: 'front' | 'back' | 'left' | 'right' | 'soft-metal' | 'detail' | 'unknown'
  quality: 'good' | 'fair' | 'poor'
  width: number
  height: number
  bytes: number
  trades: string[]
  captions: string[]
  requiresApproval: true
}

export type DamageDraft = {
  trade: string
  category: string
  severity: 'none' | 'minor' | 'moderate' | 'severe'
  evidence: string
  requiresApproval: true
}

export type ReportDraft = {
  version: 'photo-report-draft-v1'
  address: string
  trades: string[]
  missingElevations: string[]
  damages: DamageDraft[]
  statements: string[]
  requiresApproval: true
  next: string
}

const ELEVATIONS = ['front', 'back', 'left', 'right'] as const
const TRADES = ['roof', 'gutters', 'downspouts', 'siding', 'windows', 'paint', 'fascia', 'soffit'] as const

export function scorePhotoQuality(width: number, height: number, bytes: number): PhotoDraft['quality'] {
  const pixels = width * height
  if (pixels >= 2_000_000 && bytes >= 200_000) return 'good'
  if (pixels >= 800_000 && bytes >= 80_000) return 'fair'
  return 'poor'
}

export function guessElevation(name: string, notes: string): PhotoDraft['elevation'] {
  const text = `${name} ${notes}`.toLowerCase()
  if (/front|curb|street/.test(text)) return 'front'
  if (/back|rear/.test(text)) return 'back'
  if (/left/.test(text)) return 'left'
  if (/right/.test(text)) return 'right'
  if (/gutter|downspout|soft|dent|fascia|soffit/.test(text)) return 'soft-metal'
  if (/detail|close|granule|valley|flashing/.test(text)) return 'detail'
  return 'unknown'
}

export function tradesFromText(text: string): string[] {
  const found = TRADES.filter((trade) => new RegExp(trade.replace('s$', ''), 'i').test(text) || new RegExp(trade, 'i').test(text))
  return found.length ? found : ['roof']
}

export function draftPhoto(input: { id: string; name?: string; notes?: string; width?: number; height?: number; bytes?: number }): PhotoDraft {
  const width = input.width || 0
  const height = input.height || 0
  const bytes = input.bytes || 0
  const notes = input.notes || ''
  const elevation = guessElevation(input.name || '', notes)
  const quality = scorePhotoQuality(width, height, bytes)
  const trades = tradesFromText(`${input.name || ''} ${notes}`)
  const captions = [
    elevation === 'unknown' ? 'Elevation not labeled' : `${elevation} elevation`,
    quality === 'poor' ? 'Retake — low resolution' : `Quality ${quality}`,
    ...trades.map((trade) => `${trade} in frame`),
  ]
  return { id: input.id, elevation, quality, width, height, bytes, trades, captions, requiresApproval: true }
}

export function missingElevations(photos: PhotoDraft[]): string[] {
  const have = new Set(photos.map((photo) => photo.elevation))
  return ELEVATIONS.filter((elevation) => !have.has(elevation))
}

export function draftDamages(notes: string): DamageDraft[] {
  const rules: Array<{ trade: string; category: string; test: RegExp; severity: DamageDraft['severity'] }> = [
    { trade: 'roof', category: 'hail', test: /hail|bruise|granule/i, severity: 'moderate' },
    { trade: 'roof', category: 'wind', test: /wind|creased|lifted|missing shingle/i, severity: 'moderate' },
    { trade: 'gutters', category: 'dent', test: /gutter|dent/i, severity: 'minor' },
    { trade: 'downspouts', category: 'dent', test: /downspout/i, severity: 'minor' },
    { trade: 'siding', category: 'impact', test: /siding|vinyl|impact/i, severity: 'moderate' },
    { trade: 'windows', category: 'screen', test: /screen|window/i, severity: 'minor' },
    { trade: 'paint', category: 'peel', test: /paint|peel|chalk/i, severity: 'minor' },
    { trade: 'fascia', category: 'rot', test: /fascia|rot|soft wood/i, severity: 'moderate' },
    { trade: 'soffit', category: 'damage', test: /soffit/i, severity: 'minor' },
  ]
  return rules
    .filter((rule) => rule.test.test(notes))
    .map((rule) => ({ trade: rule.trade, category: rule.category, severity: rule.severity, evidence: notes.slice(0, 140), requiresApproval: true as const }))
}

export function draftPhotoReport(address: string, photos: PhotoDraft[], notes: string): ReportDraft {
  const missing = missingElevations(photos)
  const damages = draftDamages(notes)
  const trades = [...new Set(photos.flatMap((photo) => photo.trades).concat(damages.map((damage) => damage.trade)))]
  const poor = photos.filter((photo) => photo.quality === 'poor').length
  const statements = [
    `Draft report for ${address || 'unconfirmed address'}.`,
    `${photos.length} photos. Missing elevations: ${missing.join(', ') || 'none'}.`,
    poor ? `${poor} photo(s) should be retaken before the packet is trusted.` : 'Photo quality is usable.',
    damages.length ? `Possible damage: ${damages.map((d) => `${d.trade} ${d.category}`).join(', ')}.` : 'No damage language in the notes.',
    'These are drafts. Technician verification is required before any customer packet.',
  ]
  return {
    version: 'photo-report-draft-v1',
    address,
    trades,
    missingElevations: missing,
    damages,
    statements,
    requiresApproval: true,
    next: missing.length ? 'Shoot the missing elevations' : 'Verify quantities and sign',
  }
}

export const PHOTO_REPORT_OPTIONS = {
  elevations: [...ELEVATIONS, 'soft-metal', 'detail'],
  trades: [...TRADES],
  damageCategories: ['hail', 'wind', 'age', 'dent', 'impact', 'screen', 'peel', 'rot', 'leak'],
  quality: ['good', 'fair', 'poor'],
}
