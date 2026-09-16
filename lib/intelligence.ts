export type EvidenceGap = { code: string; label: string; severity: 'block' | 'warn' }
export type ReadyResult = {
  leadId: string
  score: number
  productionReady: boolean
  gaps: EvidenceGap[]
  counts: { photos: number; inspections: number; openTasks: number; warrantiesOpen: number }
}

const REQUIRED_ALBUMS = ['damage', 'general']

export function scoreProperty(input: {
  leadId: string
  status: string
  photoCount: number
  albums: string[]
  inspectionCount: number
  openTaskCount: number
  warrantyOpenCount: number
  hasPassport: boolean
  hasAddress: boolean
}): ReadyResult {
  const gaps: EvidenceGap[] = []
  if (!input.hasAddress) gaps.push({ code: 'address', label: 'Property address missing', severity: 'block' })
  if (input.inspectionCount === 0) gaps.push({ code: 'inspection', label: 'No inspection session', severity: 'block' })
  if (input.photoCount < 8) gaps.push({ code: 'photos', label: `Only ${input.photoCount} photos. Need at least 8 for a closeout packet.`, severity: 'block' })
  REQUIRED_ALBUMS.forEach((album) => {
    if (!input.albums.includes(album)) gaps.push({ code: `album_${album}`, label: `Missing ${album} photo album`, severity: 'warn' })
  })
  if (!input.hasPassport) gaps.push({ code: 'passport', label: 'Roof Passport not created', severity: 'warn' })
  if (input.warrantyOpenCount > 0) gaps.push({ code: 'warranty', label: 'Warranty packet incomplete', severity: 'warn' })
  if (['new', 'assigned'].includes(input.status)) gaps.push({ code: 'status', label: 'Lead has not been inspected', severity: 'warn' })

  const deductions = gaps.reduce((sum, gap) => sum + (gap.severity === 'block' ? 25 : 10), 0)
  const score = Math.max(0, 100 - deductions)
  return {
    leadId: input.leadId,
    score,
    productionReady: score >= 70 && !gaps.some((gap) => gap.severity === 'block'),
    gaps,
    counts: {
      photos: input.photoCount,
      inspections: input.inspectionCount,
      openTasks: input.openTaskCount,
      warrantiesOpen: input.warrantyOpenCount,
    },
  }
}
