export type SidingOpening = { id: string; widthFt: number; heightFt: number; include: boolean }

export type SidingMeasurementInput = {
  courseCount: number
  exposureInches: number
  widthFt: number
  openings: SidingOpening[]
  wastePercent: number
}

export type SidingMeasurementResult = {
  calculatedHeightFt: number
  grossAreaSqFt: number
  openingDeductionSqFt: number
  netAreaSqFt: number
  wasteSqFt: number
  orderAreaSqFt: number
}

function nonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(name+' must be a non-negative number.')
}

export function calculateSidingMeasurement(input: SidingMeasurementInput): SidingMeasurementResult {
  nonNegative(input.courseCount, 'courseCount'); nonNegative(input.exposureInches, 'exposureInches'); nonNegative(input.widthFt, 'widthFt'); nonNegative(input.wastePercent, 'wastePercent')
  if (!input.courseCount || !input.exposureInches || !input.widthFt) throw new Error('Course count, exposure, and width must be greater than zero.')
  if (input.exposureInches > 24) throw new Error('Exposure exceeds the supported range.')
  if (input.wastePercent > 100) throw new Error('Waste percent cannot exceed 100%.')
  const openingDeductionSqFt = (input.openings ?? []).reduce((sum, o) => {
    nonNegative(o.widthFt, 'opening width'); nonNegative(o.heightFt, 'opening height')
    return sum + (o.include ? o.widthFt * o.heightFt : 0)
  }, 0)
  const calculatedHeightFt = input.courseCount * input.exposureInches / 12
  const grossAreaSqFt = calculatedHeightFt * input.widthFt
  const netAreaSqFt = Math.max(0, grossAreaSqFt - openingDeductionSqFt)
  const wasteSqFt = netAreaSqFt * input.wastePercent / 100
  return { calculatedHeightFt, grossAreaSqFt, openingDeductionSqFt, netAreaSqFt, wasteSqFt, orderAreaSqFt: netAreaSqFt + wasteSqFt }
}
