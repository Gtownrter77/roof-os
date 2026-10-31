export type RoofSlopeResult = {
  rise: number
  run: number
  pitch: number
  angleDegrees: number
  label: string
}

export function classifyRoofSlope(pitch: number) {
  if (pitch <= 2) return 'Flat / low slope'
  if (pitch <= 4) return 'Low slope'
  if (pitch <= 6) return 'Standard slope'
  if (pitch <= 9) return 'Steep slope'
  if (pitch <= 12) return 'Very steep'
  return 'Extreme slope'
}

export function calculateRoofSlope(rise: number, run = 12): RoofSlopeResult | null {
  if (!Number.isFinite(rise) || !Number.isFinite(run) || rise < 0 || run <= 0) return null
  const pitch = (rise / run) * 12
  const angleDegrees = Math.atan(rise / run) * (180 / Math.PI)
  return {
    rise,
    run,
    pitch: Number(pitch.toFixed(2)),
    angleDegrees: Number(angleDegrees.toFixed(1)),
    label: classifyRoofSlope(pitch),
  }
}
