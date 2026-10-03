import assert from 'node:assert/strict'
import { calculateSidingMeasurement } from '../lib/siding/measurement.ts'
import { getApprovedSidingMeasurementQuantity } from '../lib/estimates/verified-siding-measurement.mjs'

const openings = [
  { id: 'door', widthFt: 3, heightFt: 7, include: true },
  { id: 'window', widthFt: 4, heightFt: 5, include: true },
]
const result = calculateSidingMeasurement({ courseCount: 24, exposureInches: 7.25, widthFt: 32, openings, wastePercent: 10 })
assert.equal(result.calculatedHeightFt, 14.5)
assert.equal(result.grossAreaSqFt, 464)
assert.equal(result.openingDeductionSqFt, 41)
assert.equal(result.netAreaSqFt, 423)
assert.equal(result.orderAreaSqFt, 465.3)

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  workspace_id: '22222222-2222-4222-8222-222222222222',
  inspection_id: '33333333-3333-4333-8333-333333333333',
  source_photo_id: '44444444-4444-4444-8444-444444444444',
  status: 'verified',
  course_count: 24,
  exposure_inches: 7.25,
  width_ft: 32,
  openings,
  waste_percent: 10,
  calculated_height_ft: 14.5,
  gross_area_sq_ft: 464,
  opening_deduction_sq_ft: 41,
  net_area_sq_ft: 423,
  waste_sq_ft: 42.3,
  order_area_sq_ft: 465.3,
  verified_by: '55555555-5555-4555-8555-555555555555',
  verified_at: '2026-10-02T22:00:00.000Z',
}
const approved = getApprovedSidingMeasurementQuantity(row)
assert.equal(approved.sidingSqFt, 465.3)
assert.equal(getApprovedSidingMeasurementQuantity({ ...row, status: 'unverified' }), null)
assert.equal(getApprovedSidingMeasurementQuantity({ ...row, order_area_sq_ft: 999 }), null)
console.log('siding authority regression: PASS')
