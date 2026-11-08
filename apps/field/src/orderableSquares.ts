export type FieldOrder = {
  squares: number
  squaresLabel: string
  bundles: number
  jobClass: 'repair' | 'full-replacement'
  jobLabel: string
}

/** 100 sq ft = 1sq. 1sq = 3 standard bundles. Full replacement starts at 10sq. */
export function orderableSquares(squareFeetOrSquares: number, inputIsSquares: boolean, allowSixSquareRepairThreshold = false) {
  const squareFeet = inputIsSquares ? squareFeetOrSquares * 100 : squareFeetOrSquares
  if (!Number.isFinite(squareFeet) || squareFeet <= 0 || squareFeet > 10_000) return null
  const bundles = Math.ceil((squareFeet / 100) * 3)
  const squares = bundles / 3
  const whole = Math.floor(squares)
  const remainder = bundles % 3
  const squaresLabel = remainder === 0 ? `${whole}sq` : remainder === 1 ? `${whole}.33sq` : `${whole}.66sq`
  const threshold = allowSixSquareRepairThreshold ? 6 : 10
  const jobClass = squares < threshold ? 'repair' : 'full-replacement'
  const jobLabel = jobClass === 'full-replacement'
    ? 'Full roof replacement. Starts at 10sq.'
    : allowSixSquareRepairThreshold
      ? 'Repair. Owner toggle is on, so under 6sq is a repair.'
      : 'Repair. Under 10sq is a repair by default.'
  return { squares, squaresLabel, bundles, jobClass, jobLabel } satisfies FieldOrder
}
