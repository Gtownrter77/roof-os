export const MAX_ESTIMATE_LINE_ITEMS = 200
export const MAX_LINE_ITEM_DESCRIPTION_LENGTH = 500
export const MAX_LINE_ITEM_UNIT_LENGTH = 20

export const ESTIMATE_ITEM_CATEGORIES = new Set(['material', 'labor', 'allowance', 'fee', 'tax'])

export type EstimateLineItemInput = {
  id?: string
  item_code?: string
  description: string
  category: 'material' | 'labor' | 'allowance' | 'fee' | 'tax'
  unit: string
  quantity: number
  unit_cost: number
  waste_factor?: number
  sort_order?: number
}

/** Shared creation/update contract. Returns a user-facing error, or null when valid. */
export function validateEstimateLineItems(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Line items must be an array.'
  if (value.length > MAX_ESTIMATE_LINE_ITEMS) return `An estimate cannot have more than ${MAX_ESTIMATE_LINE_ITEMS} line items.`
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object') return `Line item ${index + 1} is invalid.`
    const candidate = item as Record<string, unknown>
    if (
      typeof candidate.description !== 'string'
      || candidate.description.trim().length === 0
      || candidate.description.length > MAX_LINE_ITEM_DESCRIPTION_LENGTH
      || typeof candidate.category !== 'string'
      || !ESTIMATE_ITEM_CATEGORIES.has(candidate.category)
      || typeof candidate.unit !== 'string'
      || candidate.unit.trim().length === 0
      || candidate.unit.length > MAX_LINE_ITEM_UNIT_LENGTH
      || typeof candidate.quantity !== 'number'
      || !Number.isFinite(candidate.quantity)
      || candidate.quantity < 0
      || typeof candidate.unit_cost !== 'number'
      || !Number.isFinite(candidate.unit_cost)
      || candidate.unit_cost < 0
      || !Number.isFinite(candidate.quantity * candidate.unit_cost)
      || (candidate.item_code != null && typeof candidate.item_code !== 'string')
    ) {
      return `Line item ${index + 1} must have a description, valid category, unit, and nonnegative numeric quantity and cost.`
    }
  }
  return null
}
