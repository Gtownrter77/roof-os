// Production drafts from an approved estimate.
// Drafts only. No order is placed. No crew is dispatched.

export type MaterialLine = {
  trade: string
  item: string
  qty: string
  source: string
  requiresApproval: true
}

export type ProductionDraft = {
  version: 'production-draft-v1'
  address: string
  workOrder: string[]
  materials: MaterialLine[]
  startBlockers: string[]
  ready: boolean
  requiresApproval: true
}

export function draftProduction(input: {
  address: string
  squares: number | null
  gutterLf: number | null
  soffitIn: number | null
  fasciaIn: number | null
  estimateApproved: boolean
}): ProductionDraft {
  const startBlockers: string[] = []
  if (!input.estimateApproved) startBlockers.push('Estimate is not approved')
  if (!input.squares) startBlockers.push('Squares not verified')
  if (!input.soffitIn) startBlockers.push('Soffit width missing')
  if (!input.fasciaIn) startBlockers.push('Fascia width missing')

  const materials: MaterialLine[] = [
    { trade: 'roof', item: 'Field shingles', qty: input.squares ? `${input.squares} sq` : 'pending', source: 'estimate', requiresApproval: true },
    { trade: 'gutters', item: 'Gutter', qty: input.gutterLf ? `${input.gutterLf} LF` : 'pending', source: 'tech verify', requiresApproval: true },
    { trade: 'soffit', item: 'Soffit', qty: input.soffitIn ? `${input.soffitIn} in width` : 'pending', source: 'tech verify', requiresApproval: true },
    { trade: 'fascia', item: 'Fascia', qty: input.fasciaIn ? `${input.fasciaIn} in width` : 'pending', source: 'tech verify', requiresApproval: true },
  ]

  return {
    version: 'production-draft-v1',
    address: input.address || 'unconfirmed address',
    workOrder: [
      `Job: ${input.address || 'unconfirmed address'}`,
      input.squares ? `Tear-off and install ${input.squares} squares` : 'Squares pending — do not schedule',
      'Confirm color before the material order',
      'Photo the deck before it is closed',
    ],
    materials,
    startBlockers,
    ready: startBlockers.length === 0,
    requiresApproval: true,
  }
}
