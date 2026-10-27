export type EstimateStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'superseded'

export type EstimateCategory = 'material' | 'labor' | 'allowance' | 'fee' | 'tax'

export type EstimateLineItem = {
  id?: string
  item_code: string
  description: string
  category: EstimateCategory
  unit: string
  quantity: number
  unit_cost: number
  waste_factor?: number
  sort_order?: number
  line_total?: number
}

export type EstimateSnapshot = {
  customer?: {
    name?: string
    email?: string
    phone?: string
  }
  property?: {
    address?: string
    city?: string
    state?: string
    zip?: string
  }
  insurance?: {
    company?: string
    claim_number?: string
    adjuster?: {
      name?: string
      phone?: string
      email?: string
    }
  }
  notes?: {
    internal?: string
    customer?: string
  }
}

export type Estimate = {
  id: string
  workspace_id: string
  lead_id?: string
  template_version_id?: string
  price_book_id?: string
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'superseded'
  formula_version: string
  subtotal: number
  tax: number
  total: number
  created_by: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  estimate_snapshot: EstimateSnapshot
  estimate_line_items?: EstimateLineItem[]
}

export type EstimateLineItemInput = Omit<EstimateLineItem, 'id' | 'line_total'>

export function computeEstimateTotals(lineItems: { quantity: number; unit_cost: number; category: string }[]) {
  const subtotal = lineItems.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const tax = lineItems.filter(i => i.category === 'tax').reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  return { subtotal, tax, total: subtotal + tax }
}

export function generateEstimateNumber(workspaceId: string, createdAt: string): string {
  const date = new Date(createdAt)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const shortWs = workspaceId.slice(0, 8).toUpperCase()
  return `EST-${yyyy}${mm}${dd}-${shortWs}`
}

export const ESTIMATE_CATEGORIES: { value: 'material' | 'labor' | 'allowance' | 'fee' | 'tax'; label: string; defaultUnit: string }[] = [
  { value: 'material', label: 'Material', defaultUnit: 'SQ' },
  { value: 'labor', label: 'Labor', defaultUnit: 'HR' },
  { value: 'allowance', label: 'Allowance', defaultUnit: 'EA' },
  { value: 'fee', label: 'Fee', defaultUnit: 'EA' },
  { value: 'tax', label: 'Tax', defaultUnit: 'EA' },
]

export const COMMON_UNITS = ['SQ', 'LF', 'SF', 'EA', 'HR', 'DAY', 'ROLL', 'BOX', 'BUNDLE', 'SHEET', 'GAL', 'TUBE', 'BAG']

export function getDefaultEstimateTemplate() {
  return {
    status: 'draft' as const,
    formula_version: 'v1',
    subtotal: 0,
    tax: 0,
    total: 0,
    estimate_snapshot: {
      customer: {},
      property: {},
      insurance: {},
      notes: {},
    },
  }
}