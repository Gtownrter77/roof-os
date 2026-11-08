export type PurchasableRoofing = {
  squareFeet: number
  squares: number
  squaresLabel: string
  bundles: number
}

/** 100 sq ft = 1 square. 1 square = 3 standard bundles. Round up to a whole bundle. */
export function purchasableRoofing(squareFeet: number): PurchasableRoofing | null {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) return null
  const bundles = Math.ceil((squareFeet / 100) * 3)
  const squares = bundles / 3
  const whole = Math.floor(squares)
  const remainder = bundles % 3
  const squaresLabel = remainder === 0 ? String(whole) : remainder === 1 ? `${whole}.33` : `${whole}.66`
  return { squareFeet, squares, squaresLabel, bundles }
}
