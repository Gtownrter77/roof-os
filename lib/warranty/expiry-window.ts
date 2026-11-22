/** Helpers for the warranty-expiry cron: pagination-safe alert selection and
 * full-timestamp date comparisons. Both are pure so they can be tested without
 * a hosted database. */

export type WarrantyWindow = {
  nowIso: string
  today: string
  windowEndIso: string
  alertWindowDays: number
}

export function warrantyWindow(now: Date, days: number): WarrantyWindow | null {
  const millis = now.getTime()
  if (!Number.isFinite(millis) || !Number.isInteger(days) || days <= 0) return null
  const nowIso = now.toISOString()
  return {
    nowIso,
    today: nowIso.slice(0, 10),
    windowEndIso: new Date(millis + days * 24 * 60 * 60 * 1000).toISOString(),
    alertWindowDays: days,
  }
}

export function automationKeyForWarranty(warrantyId: string, days: number): string {
  return `warranty-expiry:${warrantyId}:${days}`
}

/** Recover warranty IDs from the tasks already created for this alert window. */
export function alreadyTaskedWarrantyIds(
  tasks: Array<{ automation_key?: string | null }>,
  days: number
): Set<string> {
  const suffix = `:${days}`
  const ids = new Set<string>()
  for (const task of tasks) {
    const key = task.automation_key
    if (typeof key !== 'string' || !key.startsWith('warranty-expiry:') || !key.endsWith(suffix)) continue
    const id = key.slice('warranty-expiry:'.length, -suffix.length)
    if (id) ids.add(id)
  }
  return ids
}

/** Filter one page before filling the alert target, so already-tasked rows at
 * the front of the expiry ordering can never starve later rows. */
export function actionableWarranties<T extends { id: string }>(
  page: T[],
  alreadyTasked: Set<string>,
  _days: number,
  remaining: number
): T[] {
  if (remaining <= 0) return []
  return page
    .filter((row) => !alreadyTasked.has(row.id))
    .slice(0, remaining)
}
