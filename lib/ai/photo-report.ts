// Insurance-grade photo → report drafts.
// Checklist from adjuster-ready practice: 4 elevations, soft-metal collateral,
// slope-by-slope test squares, three-shot findings, labeled sources.
// Drafts only. Never a customer packet.

export type Elevation = 'street' | 'front' | 'back' | 'left' | 'right' | 'slope' | 'soft-metal' | 'detail' | 'interior' | 'unknown'
export type ShotKind = 'overview' | 'context' | 'close-up' | 'test-square' | 'unknown'
export type Quality = 'good' | 'fair' | 'poor'

export type PhotoDraft = {
  id: string
  elevation: Elevation
  shot: ShotKind
  quality: Quality
  width: number
  height: number
  bytes: number
  trades: string[]
  captions: string[]
  missingScale: boolean
  requiresApproval: true
}

export type DamageDraft = {
  id: string
  trade: string
  category: string
  severity: 'none' | 'cosmetic' | 'moderate' | 'functional'
  location: string
  evidence: string
  shotsNeeded: ShotKind[]
  requiresApproval: true
}

export type ChecklistItem = { id: string; label: string; done: boolean; why: string }

export type GoldenDraftSection = {
  id: string
  title: string
  statements: string[]
  items: Array<{ label: string; value: string; source: string }>
}

export type ReportDraft = {
  version: 'photo-report-draft-v2'
  address: string
  coverageScore: number
  checklist: ChecklistItem[]
  missing: string[]
  damages: DamageDraft[]
  testSquare: { hits: number | null; band: string; note: string }
  sections: GoldenDraftSection[]
  next: string
  requiresApproval: true
}

const CHECKLIST: Array<{ id: string; label: string; test: RegExp }> = [
  { id: 'street', label: 'Street view with house number', test: /street|house number|curb/i },
  { id: 'front', label: 'Front elevation, full structure', test: /front/i },
  { id: 'back', label: 'Back elevation, full structure', test: /back|rear/i },
  { id: 'left', label: 'Left elevation', test: /left/i },
  { id: 'right', label: 'Right elevation', test: /right/i },
  { id: 'soft-gutter', label: 'Gutters', test: /gutter/i },
  { id: 'soft-downspout', label: 'Downspouts', test: /downspout/i },
  { id: 'soft-fascia', label: 'Fascia / wraps', test: /fascia/i },
  { id: 'soft-vent', label: 'Vents / AC fins', test: /vent|condenser|ac fin/i },
  { id: 'slope-overview', label: 'Slope overview', test: /slope|overview|plane/i },
  { id: 'test-square', label: 'Marked 10x10 test square', test: /test square|10x10|chalk/i },
  { id: 'close-up', label: 'Close-up with scale', test: /close|coin|quarter|scale|gauge/i },
  { id: 'ridge', label: 'Ridge / hip cap', test: /ridge|hip cap/i },
  { id: 'valley', label: 'Valley', test: /valley/i },
  { id: 'flashing', label: 'Flashing / penetrations', test: /flashing|pipe boot|chimney|skylight/i },
  { id: 'interior', label: 'Interior / attic evidence', test: /attic|interior|ceiling|stain/i },
]

export function scorePhotoQuality(width: number, height: number, bytes: number): Quality {
  const pixels = width * height
  if (pixels >= 2_000_000 && bytes >= 200_000) return 'good'
  if (pixels >= 800_000 && bytes >= 80_000) return 'fair'
  return 'poor'
}

export function guessElevation(name: string, notes: string): Elevation {
  const text = `${name} ${notes}`.toLowerCase()
  if (/street|house number/.test(text)) return 'street'
  if (/attic|interior|ceiling/.test(text)) return 'interior'
  if (/test square|slope|ridge|valley/.test(text)) return 'slope'
  if (/gutter|downspout|fascia|soft|dent|vent/.test(text)) return 'soft-metal'
  if (/close|detail|coin|scale/.test(text)) return 'detail'
  if (/front|curb/.test(text)) return 'front'
  if (/back|rear/.test(text)) return 'back'
  if (/left/.test(text)) return 'left'
  if (/right/.test(text)) return 'right'
  return 'unknown'
}

export function guessShot(name: string, notes: string): ShotKind {
  const text = `${name} ${notes}`.toLowerCase()
  if (/test square|10x10|chalk/.test(text)) return 'test-square'
  if (/close|detail|coin|scale/.test(text)) return 'close-up'
  if (/context|mid/.test(text)) return 'context'
  if (/overview|elevation|street|slope/.test(text)) return 'overview'
  return 'unknown'
}

export function tradesFromText(text: string): string[] {
  const pairs: Array<[string, RegExp]> = [
    ['roof', /roof|shingle|hail|wind/i],
    ['gutters', /gutter/i],
    ['downspouts', /downspout/i],
    ['siding', /siding|vinyl/i],
    ['windows', /window|screen/i],
    ['paint', /paint|peel/i],
    ['fascia', /fascia/i],
    ['soffit', /soffit/i],
  ]
  const found = pairs.filter(([, test]) => test.test(text)).map(([name]) => name)
  return found.length ? found : ['roof']
}

export function draftPhoto(input: { id: string; name?: string; notes?: string; width?: number; height?: number; bytes?: number }): PhotoDraft {
  const width = input.width || 0
  const height = input.height || 0
  const bytes = input.bytes || 0
  const notes = input.notes || ''
  const elevation = guessElevation(input.name || '', notes)
  const shot = guessShot(input.name || '', notes)
  const quality = scorePhotoQuality(width, height, bytes)
  const trades = tradesFromText(`${input.name || ''} ${notes}`)
  const missingScale = shot === 'close-up' && !/coin|quarter|scale|gauge|ruler/i.test(notes)
  return {
    id: input.id,
    elevation,
    shot,
    quality,
    width,
    height,
    bytes,
    trades,
    captions: [
      `${elevation} · ${shot}`,
      quality === 'poor' ? 'Retake — low resolution' : `Quality ${quality}`,
      missingScale ? 'Add a coin or gauge for scale' : 'Scale noted',
    ],
    missingScale,
    requiresApproval: true,
  }
}

export function coverageChecklist(notes: string, photos: PhotoDraft[]): ChecklistItem[] {
  const blob = `${notes} ${photos.map((p) => `${p.elevation} ${p.shot}`).join(' ')}`
  return CHECKLIST.map((item) => ({
    id: item.id,
    label: item.label,
    done: item.test.test(blob),
    why: item.test.test(blob) ? 'Present' : 'Missing from photos and notes',
  }))
}

export function classifyTestSquare(hits: number | null): { hits: number | null; band: string; note: string } {
  if (hits === null) return { hits: null, band: 'unmarked', note: 'No marked 10x10 test square yet.' }
  if (hits >= 8) return { hits, band: 'functional', note: '8+ hits in a test square. Document and verify on the roof.' }
  if (hits >= 4) return { hits, band: 'moderate', note: '4–7 hits. Borderline. Confirm functional vs cosmetic.' }
  return { hits, band: 'cosmetic', note: '0–3 hits. Document and monitor.' }
}

export function draftDamages(notes: string): DamageDraft[] {
  const rules: Array<{ trade: string; category: string; test: RegExp; severity: DamageDraft['severity']; location: string }> = [
    { trade: 'roof', category: 'hail', test: /hail|bruise|granule/i, severity: 'moderate', location: 'field' },
    { trade: 'roof', category: 'wind', test: /wind|creased|lifted|missing shingle/i, severity: 'moderate', location: 'field' },
    { trade: 'gutters', category: 'dent', test: /gutter/i, severity: 'cosmetic', location: 'eave' },
    { trade: 'downspouts', category: 'dent', test: /downspout/i, severity: 'cosmetic', location: 'elevation' },
    { trade: 'siding', category: 'impact', test: /siding|vinyl impact/i, severity: 'moderate', location: 'elevation' },
    { trade: 'windows', category: 'screen', test: /screen|window/i, severity: 'cosmetic', location: 'elevation' },
    { trade: 'fascia', category: 'dent-or-rot', test: /fascia/i, severity: 'moderate', location: 'eave' },
    { trade: 'soffit', category: 'damage', test: /soffit/i, severity: 'cosmetic', location: 'eave' },
    { trade: 'interior', category: 'stain', test: /attic|ceiling|stain|leak/i, severity: 'functional', location: 'interior' },
  ]
  return rules.filter((rule) => rule.test.test(notes)).map((rule, index) => ({
    id: `F-${index + 1}`,
    trade: rule.trade,
    category: rule.category,
    severity: rule.severity,
    location: rule.location,
    evidence: notes.slice(0, 160),
    shotsNeeded: ['overview', 'context', 'close-up'],
    requiresApproval: true as const,
  }))
}

export function draftGoldenSections(address: string, photos: PhotoDraft[], damages: DamageDraft[], checklist: ChecklistItem[], testSquare: ReturnType<typeof classifyTestSquare>): GoldenDraftSection[] {
  const missing = checklist.filter((item) => !item.done).map((item) => item.label)
  return [
    { id: 'cover', title: 'Cover', statements: [`Draft inspection report for ${address || 'unconfirmed address'}.`], items: [{ label: 'Status', value: 'Draft — not a customer packet', source: 'photo-report engine' }] },
    { id: 'looked-at', title: 'What we looked at', statements: [`${photos.length} photos reviewed.`], items: photos.slice(0, 8).map((p) => ({ label: p.id.slice(0, 8), value: `${p.elevation} · ${p.shot} · ${p.quality}`, source: 'photo draft' })) },
    { id: 'saw', title: 'What we saw', statements: damages.length ? damages.map((d) => `${d.id} ${d.trade} ${d.category} (${d.severity})`) : ['No damage language in the notes.'], items: damages.map((d) => ({ label: d.id, value: `${d.category} · ${d.severity}`, source: 'notes' })) },
    { id: 'did-not-see', title: 'What we did not see', statements: missing.length ? [`Missing: ${missing.join(', ')}`] : ['Coverage checklist is complete.'], items: [] },
    { id: 'storms', title: 'Storms', statements: [/hail|storm|wind/i.test(damages.map((d) => d.category).join(' ')) ? 'Storm language present. Confirm date before any claim talk.' : 'No storm date in the notes.'].filter(Boolean) as string[], items: [] },
    { id: 'measurements', title: 'Measurements', statements: ['No quantities from photos. Technician verification still required.'], items: [{ label: 'Test square', value: testSquare.band, source: 'notes' }] },
    { id: 'verification', title: 'Verification', statements: ['Technician has not signed this draft.'], items: [] },
    { id: 'codes', title: 'Codes', statements: ['No code call from photos.'], items: [] },
    { id: 'supplements', title: 'Supplements', statements: damages.some((d) => d.trade !== 'roof') ? ['Multi-trade items may belong on a supplement. Confirm.'] : ['Roof only so far.'], items: [] },
    { id: 'not', title: 'What this is not', statements: ['Not an insurance determination. Not a price. Not approved.'], items: [] },
    { id: 'questions', title: 'Open questions', statements: missing.slice(0, 5).map((item) => `Need: ${item}`), items: [] },
    { id: 'signatures', title: 'Signatures', statements: ['Unsigned draft.'], items: [] },
  ]
}

export function draftPhotoReport(address: string, photos: PhotoDraft[], notes: string, hits: number | null = null): ReportDraft {
  const checklist = coverageChecklist(notes, photos)
  const done = checklist.filter((item) => item.done).length
  const damages = draftDamages(notes)
  const testSquare = classifyTestSquare(hits)
  const missing = checklist.filter((item) => !item.done).map((item) => item.label)
  const poor = photos.filter((p) => p.quality === 'poor').length
  return {
    version: 'photo-report-draft-v2',
    address,
    coverageScore: Math.round((done / checklist.length) * 100),
    checklist,
    missing,
    damages,
    testSquare,
    sections: draftGoldenSections(address, photos, damages, checklist, testSquare),
    next: missing.length ? `Shoot: ${missing.slice(0, 3).join(', ')}` : poor ? 'Retake poor photos' : 'Verify quantities and sign',
    requiresApproval: true,
  }
}

export const PHOTO_REPORT_OPTIONS = {
  elevations: ['street', 'front', 'back', 'left', 'right', 'slope', 'soft-metal', 'detail', 'interior'],
  shots: ['overview', 'context', 'close-up', 'test-square'],
  trades: ['roof', 'gutters', 'downspouts', 'siding', 'windows', 'paint', 'fascia', 'soffit', 'interior'],
  collateral: ['gutters', 'downspouts', 'fascia wraps', 'vents', 'AC fins', 'mailbox', 'garage door'],
  testSquareBands: ['cosmetic 0-3', 'moderate 4-7', 'functional 8+'],
}

export type PhotoReportGate = {
  ready: boolean
  blockers: string[]
  requiresApproval: true
}

export function gatePhotoReport(input: {
  coverageScore: number
  missing: string[]
  addressBand: 'high' | 'medium' | 'low' | 'unresolved'
  pitch: number | null
  wasteFactor: number | null
  soffitIn: number | null
  fasciaIn: number | null
}): PhotoReportGate {
  const blockers: string[] = []
  if (input.coverageScore < 60) blockers.push(`Coverage ${input.coverageScore}% — need elevations and a test square`)
  if (input.missing.includes('Marked 10x10 test square')) blockers.push('Test square not marked')
  if (input.addressBand === 'low' || input.addressBand === 'unresolved') blockers.push(`Address certainty ${input.addressBand}`)
  if (!input.pitch) blockers.push('Roof slope not verified')
  if (input.wasteFactor === null) blockers.push('Waste factor not verified')
  if (!input.soffitIn) blockers.push('Soffit width (in) not verified')
  if (!input.fasciaIn) blockers.push('Fascia width (in) not verified')
  return { ready: blockers.length === 0, blockers, requiresApproval: true }
}

