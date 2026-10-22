// Estimate drafts from a verified photo packet.
// Drafts only. No price is final. No send until a technician approves.

export type EstimateOption = 'good' | 'better' | 'best'

export type EstimateLine = {
  trade: string
  option: EstimateOption
  note: string
  source: string
  requiresApproval: true
}

export type EstimateDraft = {
  version: 'estimate-draft-v1'
  address: string
  squares: number | null
  options: EstimateOption[]
  lines: EstimateLine[]
  email: string
  sms: string
  readyToSend: boolean
  blockers: string[]
  requiresApproval: true
}

export function squaresFromVerified(input: { eaveLf: number | null; rafterLf: number | null; pitch: number | null; wasteFactor: number | null }): number | null {
  if (!input.eaveLf || !input.rafterLf || input.pitch === null || input.wasteFactor === null) return null
  const slope = Math.sqrt(1 + (input.pitch / 12) ** 2)
  return Number(((input.eaveLf * input.rafterLf * slope / 100) * (1 + input.wasteFactor)).toFixed(2))
}

export function draftEstimate(input: {
  address: string
  pitch: number | null
  wasteFactor: number | null
  soffitIn: number | null
  fasciaIn: number | null
  eaveLf?: number | null
  rafterLf?: number | null
  gutterLf?: number | null
  gateReady: boolean
}): EstimateDraft {
  const squares = squaresFromVerified({
    eaveLf: input.eaveLf ?? null,
    rafterLf: input.rafterLf ?? null,
    pitch: input.pitch,
    wasteFactor: input.wasteFactor,
  })
  const blockers: string[] = []
  if (!input.gateReady) blockers.push('Photo-report gate is not clear')
  if (!input.pitch) blockers.push('Slope not verified')
  if (input.wasteFactor === null) blockers.push('Waste not verified')
  if (!input.soffitIn) blockers.push('Soffit (in) not verified')
  if (!input.fasciaIn) blockers.push('Fascia (in) not verified')

  const lines: EstimateLine[] = (['good', 'better', 'best'] as EstimateOption[]).flatMap((option) => [
    { trade: 'roof', option, note: squares ? `${squares} squares · ${option}` : `Squares pending · ${option}`, source: 'verified measurements', requiresApproval: true as const },
    { trade: 'gutters', option, note: input.gutterLf ? `${input.gutterLf} LF · ${option}` : `LF pending · ${option}`, source: 'tech verify', requiresApproval: true as const },
    { trade: 'soffit', option, note: `${input.soffitIn ?? '—'} in · ${option}`, source: 'tech verify', requiresApproval: true as const },
    { trade: 'fascia', option, note: `${input.fasciaIn ?? '—'} in · ${option}`, source: 'tech verify', requiresApproval: true as const },
  ])

  return {
    version: 'estimate-draft-v1',
    address: input.address || 'unconfirmed address',
    squares,
    options: ['good', 'better', 'best'],
    lines,
    email: `Hi, Guru Roofing drafted a Good / Better / Best estimate for ${input.address || 'your property'}. A technician still needs to confirm it.`,
    sms: `Guru Roofing: draft estimate for ${input.address || 'your property'}. Tech confirms before it is final.`,
    readyToSend: blockers.length === 0,
    blockers,
    requiresApproval: true,
  }
}
