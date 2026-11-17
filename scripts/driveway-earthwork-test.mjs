import assert from 'node:assert/strict'
import {
  calculateDrivewayLayer,
  calculateMeasuredGrade,
  calculateSurveyCellEarthwork,
  resolveAggregateTonnage,
} from '../lib/measurements/driveway-earthwork.ts'

const approximately = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`)

// Real measured spans only. Test fixtures are synthetic; never customer quantities.
const sample = calculateDrivewayLayer({
  lengthFt: 100, widthStartFt: 10, widthEndFt: 12, depthIn: 6,
  measurementEvidenceId: 'fixture-station-span',
})
approximately(sample.areaSqFt, 1100, 'tapered area')
approximately(sample.volumeFt3, 550, 'layer ft3')
approximately(sample.volumeYd3, 550 / 27, 'layer yd3')
assert.equal(sample.measurementEvidenceId, 'fixture-station-span')
approximately(calculateDrivewayLayer({
  lengthFt: 30, widthStartFt: 10, widthEndFt: 10, depthIn: 4,
  measurementEvidenceId: 'fixture-rect',
}).volumeYd3, 300 * 4 / 324, 'rectangle cubic yards')
for (const change of [
  { lengthFt: 0 }, { widthEndFt: -5 }, { depthIn: Number.NaN },
  { measurementEvidenceId: '' }, { lengthFt: Infinity },
]) {
  assert.throws(() => calculateDrivewayLayer({
    lengthFt: 30, widthStartFt: 10, widthEndFt: 10, depthIn: 4,
    measurementEvidenceId: 'fixture-rect', ...change,
  }), /invalid|positive|measur|finite|evidence/i)
}

const grade = calculateMeasuredGrade({
  runFt: 100, startElevationFt: 101, endElevationFt: 97,
  verticalDatumId: 'fixture-NAVD88', measurementEvidenceId: 'field-level-1',
})
approximately(grade.gradePercent, -4, 'longitudinal grade')
approximately(grade.riseFt, -4, 'rise')
assert.equal(grade.verticalDatumId, 'fixture-NAVD88')
assert.throws(() => calculateMeasuredGrade({
  runFt: 100, startElevationFt: 101, endElevationFt: 97,
  verticalDatumId: '', measurementEvidenceId: 'field',
}), /datum|evidence/i)
assert.throws(() => calculateMeasuredGrade({
  runFt: 0, startElevationFt: 101, endElevationFt: 97,
  verticalDatumId: 'datum', measurementEvidenceId: 'field',
}), /run|positive/i)

const earth = calculateSurveyCellEarthwork([
  { areaSqFt: 200, existingElevationFt: 101, designElevationFt: 100,
    verticalDatumId: 'fixture-datum', measurementEvidenceId: 'survey-1' },
  { areaSqFt: 100, existingElevationFt: 100, designElevationFt: 100.5,
    verticalDatumId: 'fixture-datum', measurementEvidenceId: 'survey-2' },
], 'fixture-datum')
approximately(earth.cutYd3, 200 / 27, 'cell cut')
approximately(earth.fillYd3, 50 / 27, 'cell fill')
approximately(earth.netCutYd3, 150 / 27, 'net cut')
assert.equal(earth.method, 'constant-elevation-survey-cell')
assert.throws(() => calculateSurveyCellEarthwork([
  { areaSqFt: 100, existingElevationFt: 100, designElevationFt: 99,
    verticalDatumId: 'other-datum', measurementEvidenceId: 'field' },
], 'fixture-datum'), /datum|mismatch/i)
assert.throws(() => calculateSurveyCellEarthwork([], 'datum'), /cell|survey|empty/i)
assert.throws(() => calculateSurveyCellEarthwork([
  { areaSqFt: 0, existingElevationFt: 100, designElevationFt: 99,
    verticalDatumId: 'datum', measurementEvidenceId: 'field' },
], 'datum'), /area|positive/i)

// No conversion from volume to tons without evidence-backed SAME basis yield.
const noDensity = resolveAggregateTonnage({ volumeYd3: sample.volumeYd3, volumeBasis: 'compacted' })
assert.equal(noDensity.tons, null)
assert.match(noDensity.reason, /supplier|yield|evidence|density/i)
const mass = resolveAggregateTonnage({ volumeYd3: sample.volumeYd3, volumeBasis: 'compacted',
  supplierYield: { tonsPerYd3: 1.5, basis: 'compacted', supplierEvidenceId: 'quote-fixture-1' },
})
approximately(mass.tons, sample.volumeYd3 * 1.5, 'evidence-backed tons')
assert.equal(mass.reason, null)
assert.throws(() => resolveAggregateTonnage({ volumeYd3: sample.volumeYd3, volumeBasis: 'compacted',
  supplierYield: { tonsPerYd3: 1.5, basis: 'loose', supplierEvidenceId: 'quote-fixture-1' },
}), /basis|match/i)
assert.throws(() => resolveAggregateTonnage({ volumeYd3: sample.volumeYd3, volumeBasis: 'compacted',
  supplierYield: { tonsPerYd3: 150, basis: 'compacted', supplierEvidenceId: 'quote-fixture-1' },
}), /yield|range/i)
assert.throws(() => resolveAggregateTonnage({ volumeYd3: sample.volumeYd3, volumeBasis: 'compacted',
  supplierYield: { tonsPerYd3: 1.5, basis: 'compacted', supplierEvidenceId: '' },
}), /evidence/i)

console.log('Driveway earthwork math PASS: tapered layer, field datum, cut/fill and supplier-yield hard stops')
