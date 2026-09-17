type Row = Record<string, unknown>
const drafts: Row[] = []
const measurements: Row[] = []
const photos: Row[] = []
let nextId = 1
export const db = {
  execSync: (_sql: string) => undefined,
  getFirstSync<T>(_sql: string, ..._args: unknown[]): T | null { return (drafts[0] as T | undefined) ?? null },
  getAllSync<T>(_sql: string, ..._args: unknown[]): T[] { return [] },
  runSync(sql: string, ...args: unknown[]) {
    if (sql.startsWith('INSERT INTO inspection_drafts')) { const id = nextId++; drafts.unshift({ id, remoteId: null, address: args[0], photoCount: args[1], status: 'draft', latitude: args[3], longitude: args[4], updatedAt: args[5] }); return { lastInsertRowId: id } }
    if (sql.startsWith('INSERT INTO inspection_measurements_local')) measurements.push({ args })
    if (sql.startsWith('INSERT INTO inspection_photo_queue')) photos.push({ args })
    return { lastInsertRowId: nextId++ }
  },
}
