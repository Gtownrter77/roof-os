// Production job handoff presentation helpers.
//
// The database owns the handoff record (see migration 064). This module only
// labels statuses and lists the transitions the database also enforces. It
// never derives money or scope from the browser.

export type ProductionJobStatus = 'ready' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export const PRODUCTION_JOB_STATUSES: ProductionJobStatus[] = [
  'ready',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]

export const PRODUCTION_JOB_TRANSITIONS: Record<ProductionJobStatus, ProductionJobStatus[]> = {
  ready: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const LABELS: Record<ProductionJobStatus, string> = {
  ready: 'Ready for production',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function describeProductionJobStatus(status: string): string {
  return LABELS[status as ProductionJobStatus] ?? 'Unknown status'
}

export function nextProductionJobStatuses(status: string): ProductionJobStatus[] {
  return PRODUCTION_JOB_TRANSITIONS[status as ProductionJobStatus] ?? []
}

export type ApprovedScopeLine = {
  line_item_id: string
  item_code: string
  description: string
  category: string
  unit: string
  quantity: number | string
  unit_cost: number | string
  line_total: number | string
  source_snapshot?: Record<string, unknown>
}

export function describeScopeLineCount(job: { scope_item_count?: number | null; approved_scope?: unknown }): string {
  const count = Number(job.scope_item_count ?? (Array.isArray(job.approved_scope) ? job.approved_scope.length : 0))
  return count === 1 ? '1 approved scope line' : `${count} approved scope lines`
}
