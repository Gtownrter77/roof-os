export interface RoofQuantityInput {
  eaveLf: number
  rafterLf: number
  pitch: number
  wasteFactor: number
}

export interface RoofQuantityResult {
  slopeMultiplier: number
  fieldAreaSqFt: number
  fieldSquares: number
}

export interface ApprovedPhotoWorkflowQuantities {
  roofSquares: number
  gutterLf: number
  inspectionId: string
  approvedBy: string
  approvedAt: string
}

export function calculateRoofSquares(input: RoofQuantityInput): RoofQuantityResult
export function getApprovedPhotoWorkflowQuantities(workflow: unknown): ApprovedPhotoWorkflowQuantities | null
