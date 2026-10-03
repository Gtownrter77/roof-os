export type SidingOpening = { id: string; widthFt: number; heightFt: number; include: boolean }
export type SidingMeasurementInput = { courseCount:number; exposureInches:number; widthFt:number; openings:SidingOpening[]; wastePercent:number }
export type SidingMeasurementResult = { calculatedHeightFt:number; grossAreaSqFt:number; openingDeductionSqFt:number; netAreaSqFt:number; wasteSqFt:number; orderAreaSqFt:number }
export function calculateSidingMeasurement(input:SidingMeasurementInput):SidingMeasurementResult {
 const {courseCount,exposureInches,widthFt,openings,wastePercent}=input
 if (![courseCount,exposureInches,widthFt,wastePercent].every(Number.isFinite)) throw new Error('All siding measurements must be finite numbers.')
 if (courseCount<=0||exposureInches<=0||widthFt<=0) throw new Error('Course count, exposure, and width must be greater than zero.')
 if (exposureInches>24||wastePercent<0||wastePercent>100) throw new Error('Measurement values are outside supported bounds.')
 const calculatedHeightFt=courseCount*exposureInches/12, grossAreaSqFt=calculatedHeightFt*widthFt
 const openingDeductionSqFt=openings.reduce((sum,o)=>{if(!o.include)return sum;if(!Number.isFinite(o.widthFt)||!Number.isFinite(o.heightFt)||o.widthFt<0||o.heightFt<0)throw new Error('Opening dimensions must be non-negative finite numbers.');return sum+o.widthFt*o.heightFt},0)
 const netAreaSqFt=Math.max(0,grossAreaSqFt-openingDeductionSqFt), wasteSqFt=netAreaSqFt*wastePercent/100
 return {calculatedHeightFt,grossAreaSqFt,openingDeductionSqFt,netAreaSqFt,wasteSqFt,orderAreaSqFt:netAreaSqFt+wasteSqFt}
}
