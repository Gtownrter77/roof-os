export type SidingWall = {
  name: string
  widthFt: number
  stories: number
  rows: number
  exposureIn: number
}

export type SidingSectionResult = SidingWall & {
  sidingHeightFt: number
  grossSqFt: number
}

export type SidingMeasurementResult = {
  sections: SidingSectionResult[]
  grossSqFt: number
  wasteFactor: number
  materialSqFt: number
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`)
  }
  return value
}

export function calculateSidingSection(section: SidingWall): SidingSectionResult {
  const widthFt = finitePositive(section.widthFt, 'Width')
  const stories = finitePositive(section.stories, 'Stories')
  const rows = finitePositive(section.rows, 'Rows')
  const exposureIn = finitePositive(section.exposureIn, 'Exposure')

  const sidingHeightFt = (rows * exposureIn) / 12
  const grossSqFt = widthFt * sidingHeightFt * stories

  return { ...section, widthFt, stories, rows, exposureIn, sidingHeightFt, grossSqFt }
}

export function calculateSidingMeasurement(
  sections: SidingWall[],
  wasteFactorPercent: number,
): SidingMeasurementResult {
  if (!sections.length) throw new Error('At least one siding section is required.')
  if (!Number.isFinite(wasteFactorPercent) || wasteFactorPercent < 0 || wasteFactorPercent > 100) {
    throw new Error('Waste factor must be between 0% and 100%.')
  }

  const calculated = sections.map(calculateSidingSection)
  const grossSqFt = calculated.reduce((sum, section) => sum + section.grossSqFt, 0)
  const wasteFactor = wasteFactorPercent / 100
  const materialSqFt = grossSqFt * (1 + wasteFactor)

  return { sections: calculated, grossSqFt, wasteFactor, materialSqFt }
}
