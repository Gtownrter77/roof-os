/** Pure workspace-scoping guards. Kept framework-free so cross-tenant checks can
 * be asserted locally without a hosted database. RLS remains the primary
 * boundary; these are defense-in-depth checks on caller-supplied identifiers. */

type ScopedRow = { workspace_id?: string | null }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Return the row only when its workspace_id matches the caller's workspace. */
export function assertSameWorkspace<T extends ScopedRow>(
  row: T | null | undefined,
  workspaceId: string | null | undefined
): T | null {
  if (!isRecord(row) || !workspaceId) return null
  return row.workspace_id === workspaceId ? (row as T) : null
}

/** A caller-supplied inspection id is reusable only if a workspace-scoped lookup
 * already found that exact id inside the caller's workspace. */
export function resolveInspectionForUpload(
  paramId: string | null | undefined,
  sessions: Array<ScopedRow & { id: string }> | null | undefined,
  workspaceId: string | null | undefined
): string | null {
  if (!paramId || !workspaceId || !Array.isArray(sessions)) return null
  const match = sessions.find((session) => session.id === paramId && session.workspace_id === workspaceId)
  return match ? paramId : null
}

/** Both foreign ids a measurement references must resolve in the caller's
 * workspace before the measurement row is written. */
export function foreignReferencesInWorkspace(
  inspection: ScopedRow | null | undefined,
  photo: ScopedRow | null | undefined,
  workspaceId: string | null | undefined
): boolean {
  if (!workspaceId) return false
  return Boolean(
    isRecord(inspection) && inspection.workspace_id === workspaceId &&
    isRecord(photo) && photo.workspace_id === workspaceId
  )
}
