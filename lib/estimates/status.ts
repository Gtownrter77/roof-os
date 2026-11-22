export const ESTIMATE_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'superseded'] as const
export type EstimateStatus = typeof ESTIMATE_STATUSES[number]

/** States in which the owner lock sequence must not be started or changed. */
export const TERMINAL_ESTIMATE_STATUSES = new Set<EstimateStatus>(['approved', 'rejected', 'superseded'])

export function canTagEstimateLocks(status: unknown): boolean {
  return typeof status === 'string' && !TERMINAL_ESTIMATE_STATUSES.has(status as EstimateStatus)
}
