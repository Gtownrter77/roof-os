const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getApprovedSidingMeasurementQuantity(row) {
  if (!row || row.status !== 'verified') return null
  if (!UUID.test(row.id) || !UUID.test(row.workspace_id) || !UUID.test(row.inspection_id) || !UUID.test(row.source_photo_id)) return null
  const quantity = Number(row.order_area_sq_ft)
  const net = Number(row.net_area_sq_ft)
  const gross = Number(row.gross_area_sq_ft)
  const waste = Number(row.waste_sq_ft)
  const height = Number(row.calculated_height_ft)
  const courses = Number(row.course_count)
  const exposure = Number(row.exposure_inches)
  const width = Number(row.width_ft)
  const wastePercent = Number(row.waste_percent)
  if (![quantity, net, gross, waste, height, courses, exposure, width, wastePercent].every(Number.isFinite)) return null
  if (quantity <= 0 || quantity > 100000 || net < 0 || gross <= 0 || waste < 0 || height <= 0 || courses <= 0 || exposure <= 0 || width <= 0 || wastePercent < 0 || wastePercent > 100) return null
  const expectedHeight = courses * exposure / 12
  const expectedGross = expectedHeight * width
  const openings = Array.isArray(row.openings) ? row.openings : []
  const expectedOpenings = openings.reduce((sum, opening) => {
    if (!opening || opening.include !== true) return sum
    const w = Number(opening.widthFt)
    const h = Number(opening.heightFt)
    return Number.isFinite(w) && Number.isFinite(h) && w >= 0 && h >= 0 ? sum + w * h : Number.NaN
  }, 0)
  const expectedNet = Math.max(0, expectedGross - expectedOpenings)
  const expectedWaste = expectedNet * wastePercent / 100
  const expectedQuantity = expectedNet + expectedWaste
  if (![expectedHeight, expectedGross, expectedOpenings, expectedNet, expectedWaste, expectedQuantity].every(Number.isFinite)) return null
  if (Math.abs(height - expectedHeight) > 0.01 || Math.abs(gross - expectedGross) > 0.01 || Math.abs(net - expectedNet) > 0.01 || Math.abs(waste - expectedWaste) > 0.01 || Math.abs(quantity - expectedQuantity) > 0.01) return null
  if (!UUID.test(row.verified_by) || typeof row.verified_at !== 'string') return null
  return { sidingSqFt: quantity, inspectionId: row.inspection_id, sourcePhotoId: row.source_photo_id, verifiedBy: row.verified_by, verifiedAt: row.verified_at }
}
