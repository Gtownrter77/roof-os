// Conceptual, non-orderable roof-area preview from a mapped building footprint.
// Never use this alone to approve a roofing estimate or order materials.
export type FootprintProjection = {
  horizontalSqFt: number
  illustrativeSlopedSqFt: number
  pitchRisePer12: number
  slopeMultiplier: number
  verified: false
}
export function previewRoofAreaFromFootprint(
  footprintSqFt: number,
  pitchRisePer12: number,
): FootprintProjection | null {
  if (!Number.isFinite(footprintSqFt) || footprintSqFt <= 0 || footprintSqFt > 20_000_000
      || !Number.isFinite(pitchRisePer12) || pitchRisePer12 < 0 || pitchRisePer12 > 36) return null
  const slopeMultiplier = Math.hypot(12, pitchRisePer12) / 12
  return {
    horizontalSqFt: footprintSqFt,
    illustrativeSlopedSqFt: footprintSqFt * slopeMultiplier,
    pitchRisePer12,
    slopeMultiplier,
    verified: false,
  }
}
