export type PurchasableRoofing = {
  squareFeet: number
  squares: number
  squaresLabel: string
  bundles: number
}

export const MIN_ROOF_AREA_SQFT = 600
export const MAX_ROOF_AREA_SQFT = 10_000

export function roofAreaRangeError(squareFeet: number): string | null {
  if (!Number.isFinite(squareFeet)) return 'Enter a valid roof area in square feet.'
  if (squareFeet < MIN_ROOF_AREA_SQFT || squareFeet > MAX_ROOF_AREA_SQFT) {
    return `Roof area must be between ${MIN_ROOF_AREA_SQFT.toLocaleString()} and ${MAX_ROOF_AREA_SQFT.toLocaleString()} sq ft.`
  }
  return null
}

/** 100 sq ft = 1 square. 1 square = 3 standard bundles. Round up to a whole bundle. */
export function purchasableRoofing(squareFeet: number): PurchasableRoofing | null {
  if (roofAreaRangeError(squareFeet)) return null
  const bundles = Math.ceil((squareFeet / 100) * 3)
  const squares = bundles / 3
  const whole = Math.floor(squares)
  const remainder = bundles % 3
  const squaresLabel = remainder === 0 ? String(whole) : remainder === 1 ? `${whole}.33` : `${whole}.66`
  return { squareFeet, squares, squaresLabel, bundles }
}

