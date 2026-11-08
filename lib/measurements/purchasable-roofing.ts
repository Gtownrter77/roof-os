export type RoofJobClass = 'repair' | 'full-replacement'

export type PurchasableRoofing = {
  squareFeet: number
  squares: number
  squaresLabel: string
  bundles: number
  jobClass: RoofJobClass
  jobLabel: string
}

/** Full replacement starts here. 10SQ = 1,000 sq ft. This is the default. */
export const FULL_REPLACEMENT_MIN_SQ = 10
export const FULL_REPLACEMENT_MIN_SQFT = FULL_REPLACEMENT_MIN_SQ * 100
/** Optional owner setting only. Never the default. 6SQ = 600 sq ft. */
export const OPTIONAL_REPAIR_THRESHOLD_SQ = 6
export const OPTIONAL_REPAIR_THRESHOLD_SQFT = OPTIONAL_REPAIR_THRESHOLD_SQ * 100
export const MAX_ROOF_AREA_SQFT = 10_000

export function roofAreaRangeError(squareFeet: number): string | null {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) return 'Enter a valid roof area in square feet.'
  if (squareFeet > MAX_ROOF_AREA_SQFT) return `Roof area cannot exceed ${(MAX_ROOF_AREA_SQFT / 100).toFixed(0)}SQ.`
  return null
}

export function classifyRoofJob(squareFeet: number, allowSixSquareRepairThreshold = false): RoofJobClass {
  const thresholdSqFt = allowSixSquareRepairThreshold ? OPTIONAL_REPAIR_THRESHOLD_SQFT : FULL_REPLACEMENT_MIN_SQFT
  return squareFeet < thresholdSqFt ? 'repair' : 'full-replacement'
}

function jobLabel(jobClass: RoofJobClass, allowSixSquareRepairThreshold: boolean) {
  if (jobClass === 'full-replacement') return 'Full roof replacement. Starts at 10SQ.'
  if (allowSixSquareRepairThreshold) return 'Repair. Owner toggle is on, so under 6SQ is a repair.'
  return 'Repair. Under 10SQ is a repair by default.'
}

/** 100 sq ft = 1SQ. 1SQ = 3 standard bundles. Round up to a whole bundle. */
export function purchasableRoofing(squareFeet: number, allowSixSquareRepairThreshold = false): PurchasableRoofing | null {
  if (roofAreaRangeError(squareFeet)) return null
  const bundles = Math.ceil((squareFeet / 100) * 3)
  const squares = bundles / 3
  const whole = Math.floor(squares)
  const remainder = bundles % 3
  const squaresLabel = remainder === 0 ? `${whole}SQ` : remainder === 1 ? `${whole}.33SQ` : `${whole}.66SQ`
  const jobClass = classifyRoofJob(squareFeet, allowSixSquareRepairThreshold)
  return { squareFeet, squares, squaresLabel, bundles, jobClass, jobLabel: jobLabel(jobClass, allowSixSquareRepairThreshold) }
}
