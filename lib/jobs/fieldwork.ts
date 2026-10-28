// Field work evidence and change-order review helpers.
//
// Daily updates are append-only. A change order starts requested and is
// approved or declined by a workspace owner or administrator. An approved
// change order is a separate invoice input: it never rewrites the accepted
// amount or approved scope on the handoff snapshot.

export const CHANGE_ORDER_STATUSES = ['requested', 'approved', 'declined'] as const
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number]

export const CHANGE_ORDER_DECISIONS = ['approved', 'declined'] as const
export type ChangeOrderDecision = (typeof CHANGE_ORDER_DECISIONS)[number]

export function describeChangeOrderStatus(status: string): string {
  switch (status) {
    case 'requested': return 'Awaiting owner review'
    case 'approved': return 'Approved'
    case 'declined': return 'Declined'
    default: return 'Unknown status'
  }
}

/** Owner decisions available for the current status. Empty after a decision. */
export function nextChangeOrderDecisions(status: string): ChangeOrderDecision[] {
  return status === 'requested' ? [...CHANGE_ORDER_DECISIONS] : []
}

const WORK_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A work date must be a real calendar date and must not be in the future. */
export function isValidWorkDate(value: unknown, today: string): boolean {
  if (typeof value !== 'string' || !WORK_DATE_RE.test(value)) return false
  if (!WORK_DATE_RE.test(today)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime())) return false
  if (parsed.toISOString().slice(0, 10) !== value) return false
  return value <= today
}

export interface ChangeOrderLike {
  status?: string | null
  amount_delta?: number | string | null
}

export interface ChangeOrderSummary {
  requested_count: number
  approved_count: number
  declined_count: number
  /** Sum of approved deltas only. Declined and pending requests never count. */
  approved_delta_total: number
  /** Sum of pending deltas, for context only. Never invoiced. */
  requested_delta_total: number
  has_pending: boolean
}

const toAmount = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function summarizeChangeOrders(rows: ChangeOrderLike[]): ChangeOrderSummary {
  const summary: ChangeOrderSummary = {
    requested_count: 0,
    approved_count: 0,
    declined_count: 0,
    approved_delta_total: 0,
    requested_delta_total: 0,
    has_pending: false,
  }

  for (const row of rows) {
    const amount = toAmount(row.amount_delta)
    if (row.status === 'approved') {
      summary.approved_count += 1
      summary.approved_delta_total += amount
    } else if (row.status === 'declined') {
      summary.declined_count += 1
    } else if (row.status === 'requested') {
      summary.requested_count += 1
      summary.requested_delta_total += amount
    }
  }

  summary.approved_delta_total = round2(summary.approved_delta_total)
  summary.requested_delta_total = round2(summary.requested_delta_total)
  summary.has_pending = summary.requested_count > 0
  return summary
}

/** Signed currency label for a delta. A credit is negative and never hidden. */
export function describeAmountDelta(value: number | string): string {
  const amount = toAmount(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  if (amount > 0) return `+${formatted}`
  if (amount < 0) return `-${formatted}`
  return formatted
}
