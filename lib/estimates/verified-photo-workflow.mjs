const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function closeEnough(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 0.01
}

export function calculateRoofSquares({ eaveLf, rafterLf, pitch, wasteFactor }) {
  const slopeMultiplier = Math.sqrt(1 + (pitch / 12) ** 2)
  const fieldAreaSqFt = eaveLf * rafterLf * slopeMultiplier
  const fieldSquares = fieldAreaSqFt / 100 * (1 + wasteFactor)
  return {
    slopeMultiplier: Number(slopeMultiplier.toFixed(4)),
    fieldAreaSqFt: Number(fieldAreaSqFt.toFixed(2)),
    fieldSquares: Number(fieldSquares.toFixed(2)),
  }
}

/**
 * Return quantities only when the saved workflow contains a consistent,
 * approved technician verification. Initial/unapproved workflow values are
 * never used as estimate quantities.
 */
export function getApprovedPhotoWorkflowQuantities(workflow) {
  if (!isRecord(workflow) || workflow.status !== 'approved') return null
  if (!UUID.test(workflow.id) || !UUID.test(workflow.workspace_id) || !UUID.test(workflow.inspection_id)) return null
  if (!UUID.test(workflow.approved_by) || typeof workflow.approved_at !== 'string') return null

  const approvedAt = Date.parse(workflow.approved_at)
  if (!Number.isFinite(approvedAt)) return null

  const report = workflow.report
  if (!isRecord(report) || report.status !== 'approved_for_customer_packet' || !isRecord(report.technicianVerification)) return null
  const verification = report.technicianVerification
  if (verification.decision !== 'verified_by_technician' || verification.verifiedBy !== workflow.approved_by) return null
  if (typeof verification.verifiedAt !== 'string' || Date.parse(verification.verifiedAt) !== approvedAt) return null

  const { eaveLf, rafterLf, pitch, wasteFactor, gutterLf, fieldSquares } = verification
  if (![eaveLf, rafterLf, pitch, wasteFactor, gutterLf, fieldSquares].every(isFiniteNumber)) return null
  if (eaveLf <= 0 || eaveLf > 10_000 || rafterLf <= 0 || rafterLf > 10_000) return null
  if (pitch < 0 || pitch > 24 || wasteFactor < 0 || wasteFactor > 1) return null
  if (gutterLf < 0 || gutterLf > 10_000) return null

  const derived = calculateRoofSquares({ eaveLf, rafterLf, pitch, wasteFactor })
  const storedRoofSquares = Number(workflow.roof_squares)
  const storedGutterLf = Number(workflow.gutter_lf)
  if (!Number.isFinite(storedRoofSquares) || storedRoofSquares <= 0 || storedRoofSquares > 100_000) return null
  if (!Number.isFinite(storedGutterLf) || storedGutterLf < 0 || storedGutterLf > 10_000) return null
  if (!closeEnough(fieldSquares, derived.fieldSquares) || !closeEnough(storedRoofSquares, derived.fieldSquares)) return null
  if (!closeEnough(storedGutterLf, gutterLf)) return null

  return {
    roofSquares: derived.fieldSquares,
    gutterLf: Number(gutterLf.toFixed(2)),
    inspectionId: workflow.inspection_id,
    approvedBy: workflow.approved_by,
    approvedAt: workflow.approved_at,
  }
}
