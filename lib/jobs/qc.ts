// QC punch list and supervisor closeout helpers.
//
// A punch item is a QC defect. Critical items block the supervisor closeout
// and the completion of the job. A resolved item is immutable, so a correction
// is a new item. A closeout is one immutable record per job.
//
// Nothing here changes the handoff snapshot, the schedule, the deposit, a
// change order, or a customer record.

export const PUNCH_SEVERITIES = ['critical', 'major', 'minor'] as const
export type PunchSeverity = (typeof PUNCH_SEVERITIES)[number]

export const PUNCH_STATUSES = ['open', 'resolved'] as const
export type PunchStatus = (typeof PUNCH_STATUSES)[number]

const SEVERITY_LABELS: Record<PunchSeverity, string> = {
  critical: 'Critical — blocks completion',
  major: 'Major',
  minor: 'Minor',
}

const STATUS_LABELS: Record<PunchStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
}

export function describePunchSeverity(severity: string): string {
  return SEVERITY_LABELS[severity as PunchSeverity] ?? 'Unknown severity'
}

export function describePunchStatus(status: string): string {
  return STATUS_LABELS[status as PunchStatus] ?? 'Unknown status'
}

/** Only an open item can be resolved. A resolved item cannot be reopened. */
export function canResolvePunchItem(status: string): boolean {
  return status === 'open'
}

export interface PunchItemLike {
  severity?: string | null
  status?: string | null
}

export interface PunchSummary {
  total: number
  open_total: number
  open_critical: number
  open_major: number
  open_minor: number
  resolved_total: number
}

export function summarizePunch(items: PunchItemLike[]): PunchSummary {
  const summary: PunchSummary = {
    total: 0,
    open_total: 0,
    open_critical: 0,
    open_major: 0,
    open_minor: 0,
    resolved_total: 0,
  }

  for (const item of items) {
    summary.total += 1
    if (item.status !== 'open') {
      summary.resolved_total += 1
      continue
    }
    summary.open_total += 1
    if (item.severity === 'critical') summary.open_critical += 1
    else if (item.severity === 'major') summary.open_major += 1
    else if (item.severity === 'minor') summary.open_minor += 1
  }

  return summary
}

export interface CloseoutGate {
  /** True only when no critical punch item is open. */
  can_close: boolean
  open_critical: number
  open_total: number
  /** Reasons closeout is blocked. Empty when the gate is open. */
  blockers: string[]
}

/**
 * The closeout gate. Only critical items block it. Open major and minor items
 * are counted and reported but do not block; they are recorded in the closeout
 * snapshot as known open work.
 */
export function evaluateCloseoutGate(items: PunchItemLike[]): CloseoutGate {
  const summary = summarizePunch(items)
  const blockers: string[] = []
  if (summary.open_critical > 0) {
    blockers.push(
      summary.open_critical === 1
        ? 'Resolve 1 critical punch item before closeout.'
        : `Resolve ${summary.open_critical} critical punch items before closeout.`,
    )
  }
  return {
    can_close: blockers.length === 0,
    open_critical: summary.open_critical,
    open_total: summary.open_total,
    blockers,
  }
}
