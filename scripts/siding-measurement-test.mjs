import assert from 'node:assert/strict'
import { calculateSidingMeasurement } from '../lib/siding/measurement'
const r=calculateSidingMeasurement({courseCount:24, exposureInches:7.25, widthFt:32, openings:[{id:'door',widthFt:3,heightFt:7,include:true},{id:'window',widthFt:4,heightFt:5,include:true}], wastePercent:10})
assert.equal(r.calculatedHeightFt,14.5)
assert.equal(r.grossAreaSqFt,464)
assert.equal(r.openingDeductionSqFt,41)
assert.equal(r.netAreaSqFt,423)
assert.equal(r.orderAreaSqFt,465.3)
console.log('siding measurement authority: PASS')
