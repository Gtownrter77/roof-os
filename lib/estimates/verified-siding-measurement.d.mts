export interface ApprovedSidingMeasurementQuantity {
  sidingSqFt: number
  inspectionId: string
  sourcePhotoId: string
  verifiedBy: string
  verifiedAt: string
}

export function getApprovedSidingMeasurementQuantity(row: unknown): ApprovedSidingMeasurementQuantity | null
