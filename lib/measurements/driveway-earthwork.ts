/**
 * Evidence-led, deterministic driveway measurement math.
 *
 * This is NOT a survey, civil design, price quote, or approval engine.
 * Measurements and their provenance must be supplied explicitly.
 * All volumes are geometric and unrounded; never assume a supplier density,
 * a shrink/swell factor, a loose-to-compacted yield, or an earthwork design.
 */

export type DrivewayLayerInput = {
  lengthFt: number
  widthStartFt: number
  widthEndFt: number
  depthIn: number
  measurementEvidenceId: string
}

export type DrivewayLayerQuantity = {
  areaSqFt: number
  volumeFt3: number
  volumeYd3: number
  measurementEvidenceId: string
  method: 'tapered-plan-layer'
}

export type SurveyedGradeInput = {
  runFt: number
  startElevationFt: number
  endElevationFt: number
  verticalDatumId: string
  measurementEvidenceId: string
}

export type SurveyedGrade = {
  riseFt: number
  gradePercent: number
  verticalDatumId: string
  measurementEvidenceId: string
}

export type SurveyCell = {
  areaSqFt: number
  existingElevationFt: number
  designElevationFt: number
  verticalDatumId: string
  measurementEvidenceId: string
}

export type SurveyCellEarthwork = {
  cutYd3: number
  fillYd3: number
  netCutYd3: number
  cellCount: number
  verticalDatumId: string
  method: 'constant-elevation-survey-cell'
}

export type VolumeBasis = 'loose' | 'compacted' | 'in-place'

export type SupplierYield = {
  /** A source-provided tons-per-cubic-yard factor for the SAME volume basis. */
  tonsPerYd3: number
  basis: VolumeBasis
  supplierEvidenceId: string
}

export type AggregateTonnageInput = {
  volumeYd3: number
  volumeBasis: VolumeBasis
  supplierYield?: SupplierYield
}

export type AggregateTonnage = {
  tons: number | null
  reason: string | null
}

const FEET_PER_YARD = 3
const CUBIC_FEET_PER_YARD = FEET_PER_YARD ** 3
const INCHES_PER_FOOT = 12

function positiveNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number.`)
  }
  return value
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`)
  }
  return value
}

function nonNegativeNumber(value: unknown, label: string): number {
  const numeric = finiteNumber(value, label)
  if (numeric < 0) throw new RangeError(`${label} cannot be negative.`)
  return numeric
}

function evidenceString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 256) {
    throw new RangeError(`${label} requires an evidence identifier of 1–256 characters.`)
  }
  return value.trim()
}

function verifiedVolumeBasis(value: unknown): VolumeBasis {
  if (value !== 'loose' && value !== 'compacted' && value !== 'in-place') {
    throw new RangeError('Volume basis must be loose, compacted or in-place.')
  }
  return value
}

function checkOutput(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} is outside calculable limits.`)
  return value
}

/**
 * Approximate a straight segment with linearly varying width by a trapezoid.
 * Irregular/curved footprints require an independently reviewed polygon, not
 * this simplified method. The depth is a measured/designed input, not guessed.
 */
export function calculateDrivewayLayer(input: DrivewayLayerInput): DrivewayLayerQuantity {
  const lengthFt = positiveNumber(input?.lengthFt, 'Segment length')
  const widthStartFt = positiveNumber(input?.widthStartFt, 'Start width')
  const widthEndFt = positiveNumber(input?.widthEndFt, 'End width')
  const depthIn = positiveNumber(input?.depthIn, 'Layer depth')
  const measurementEvidenceId = evidenceString(input?.measurementEvidenceId, 'Measurement evidence')
  const areaSqFt = checkOutput(lengthFt * (widthStartFt + widthEndFt) / 2, 'Driveway area')
  const volumeFt3 = checkOutput(areaSqFt * depthIn / INCHES_PER_FOOT, 'Driveway volume')
  const volumeYd3 = checkOutput(volumeFt3 / CUBIC_FEET_PER_YARD, 'Driveway volume')
  return { areaSqFt, volumeFt3, volumeYd3, measurementEvidenceId, method: 'tapered-plan-layer' }
}

/** Compute signed rise and longitudinal grade from elevations on one datum. */
export function calculateMeasuredGrade(input: SurveyedGradeInput): SurveyedGrade {
  const runFt = positiveNumber(input?.runFt, 'Horizontal run')
  const start = finiteNumber(input?.startElevationFt, 'Start elevation')
  const end = finiteNumber(input?.endElevationFt, 'End elevation')
  const verticalDatumId = evidenceString(input?.verticalDatumId, 'Vertical datum')
  const measurementEvidenceId = evidenceString(input?.measurementEvidenceId, 'Measurement evidence')
  const riseFt = end - start
  const gradePercent = riseFt / runFt * 100
  if (!Number.isFinite(gradePercent)) throw new RangeError('Calculated grade is not finite.')
  return { riseFt, gradePercent, verticalDatumId, measurementEvidenceId }
}

/**
 * Survey cell prism approximation. Caller supplies real, measured cell area
 * and co-datum existing/design elevations; no interpolation or DEM surveying
 * is performed here. Cut is positive when existing grade is above design.
 */
export function calculateSurveyCellEarthwork(cells: SurveyCell[], expectedDatumId: string): SurveyCellEarthwork {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new RangeError('At least one survey cell is required.')
  }
  const datum = evidenceString(expectedDatumId, 'Vertical datum')
  let cutFt3 = 0
  let fillFt3 = 0
  for (const cell of cells) {
    const area = positiveNumber(cell?.areaSqFt, 'Survey cell area')
    const existing = finiteNumber(cell?.existingElevationFt, 'Existing survey elevation')
    const design = finiteNumber(cell?.designElevationFt, 'Design survey elevation')
    const cellDatum = evidenceString(cell?.verticalDatumId, 'Survey cell vertical datum')
    evidenceString(cell?.measurementEvidenceId, 'Survey cell measurement evidence')
    if (cellDatum !== datum) throw new RangeError('Survey cell vertical datum mismatch.')
    const delta = existing - design
    if (delta > 0) cutFt3 += area * delta
    else if (delta < 0) fillFt3 += area * -delta
    checkOutput(cutFt3, 'Accumulated cut')
    checkOutput(fillFt3, 'Accumulated fill')
  }
  const cutYd3 = cutFt3 / CUBIC_FEET_PER_YARD
  const fillYd3 = fillFt3 / CUBIC_FEET_PER_YARD
  checkOutput(cutYd3, 'Calculated cut')
  checkOutput(fillYd3, 'Calculated fill')
  return { cutYd3, fillYd3, netCutYd3: cutYd3 - fillYd3, cellCount: cells.length,
    verticalDatumId: datum, method: 'constant-elevation-survey-cell' }
}

/**
 * No automatic tonnage without specific supplier evidence and matching basis.
 * Source ID is an input record, NOT an independent authentication of the quote.
 * Additional conversion from in-place to loose/compacted needs a separate
 * measured yield: a matching label alone never establishes compaction.
 */
export function resolveAggregateTonnage(input: AggregateTonnageInput): AggregateTonnage {
  const volumeYd3 = nonNegativeNumber(input?.volumeYd3, 'Volume')
  const volumeBasis = verifiedVolumeBasis(input?.volumeBasis)
  if (input?.supplierYield == null) {
    return { tons: null, reason: 'Supplier yield/density evidence is required before converting cubic yards to tons.' }
  }
  const yieldRecord = input.supplierYield
  const tonsPerYd3 = positiveNumber(yieldRecord.tonsPerYd3, 'Supplier yield')
  // Intentional typo/unit hard stop: a value like "150 lb" cannot be
  // silently treated as 150 tons per cubic yard. Review extreme density.
  if (tonsPerYd3 > 25) throw new RangeError('Supplier yield outside supported range: verify units and source.')
  const basis = verifiedVolumeBasis(yieldRecord.basis)
  evidenceString(yieldRecord.supplierEvidenceId, 'Supplier evidence')
  if (basis !== volumeBasis) throw new RangeError('Supplier yield basis must match the provided volume basis.')
  const tons = checkOutput(volumeYd3 * tonsPerYd3, 'Aggregate tons')
  return { tons, reason: null }
}
