type Row = Record<string, unknown>

type DraftRow = Row & {
  id: number
  ownerUserId: string | null
  workspaceId: string | null
  clientId: string
  address: string
  photoCount: number
  status: string
  latitude: number | null
  longitude: number | null
  updatedAt: string
}

type MeasurementRow = Row & {
  id: number
  draft_id: number
  client_id: string
  roof_squares: number
  gutter_lf: number
  latitude: number | null
  longitude: number | null
  captured_at: string
  sync_status: 'queued'
  next_retry_at: string | null
}

type PhotoRow = Row & {
  id: number
  draft_id: number
  client_id: string
  local_uri: string
  captured_at: string
}

const drafts: DraftRow[] = []
const measurements: MeasurementRow[] = []
const photos: PhotoRow[] = []
let nextId = 1

export const db = {
  execSync: (_sql: string) => undefined,

  getFirstSync<T>(sql: string, ...args: unknown[]): T | null {
    if (!sql.includes('FROM inspection_drafts')) return null

    const ownerUserId = typeof args[0] === 'string' ? args[0] : null
    const row = drafts
      .filter((draft) => !ownerUserId || draft.ownerUserId === ownerUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

    return (row as T | undefined) ?? null
  },

  getAllSync<T>(sql: string, ...args: unknown[]): T[] {
    if (sql.includes('FROM inspection_measurements_local')) {
      const draftId = Number(args[0])
      const allowedStatuses = new Set([args[1], args[2]])
      const now = typeof args[3] === 'string' ? args[3] : new Date().toISOString()

      return measurements
        .filter((measurement) =>
          measurement.draft_id === draftId
          && allowedStatuses.has(measurement.sync_status)
          && (!measurement.next_retry_at || measurement.next_retry_at <= now)
        )
        .map((measurement) => ({
          id: measurement.id,
          client_id: measurement.client_id,
          roof_squares: measurement.roof_squares,
          gutter_lf: measurement.gutter_lf,
          latitude: measurement.latitude,
          longitude: measurement.longitude,
          captured_at: measurement.captured_at,
        }) as T)
    }

    return []
  },

  runSync(sql: string, ...args: unknown[]) {
    if (sql.startsWith('INSERT INTO inspection_drafts')) {
      const id = nextId++
      drafts.unshift({
        id,
        ownerUserId: typeof args[0] === 'string' ? args[0] : null,
        workspaceId: typeof args[1] === 'string' ? args[1] : null,
        clientId: String(args[2] ?? ''),
        address: String(args[3] ?? ''),
        photoCount: Number(args[4] ?? 0),
        status: String(args[5] ?? 'draft'),
        latitude: args[6] == null ? null : Number(args[6]),
        longitude: args[7] == null ? null : Number(args[7]),
        updatedAt: String(args[8] ?? new Date().toISOString()),
      })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('INSERT INTO inspection_measurements_local')) {
      const id = nextId++
      measurements.unshift({
        id,
        draft_id: Number(args[0]),
        client_id: String(args[1] ?? ''),
        roof_squares: Number(args[2] ?? 0),
        gutter_lf: Number(args[3] ?? 0),
        latitude: args[4] == null ? null : Number(args[4]),
        longitude: args[5] == null ? null : Number(args[5]),
        captured_at: String(args[6] ?? new Date().toISOString()),
        sync_status: 'queued',
        next_retry_at: null,
      })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('INSERT INTO inspection_photo_queue')) {
      const id = nextId++
      photos.unshift({
        id,
        draft_id: Number(args[0]),
        client_id: String(args[1] ?? ''),
        local_uri: String(args[2] ?? ''),
        captured_at: String(args[3] ?? new Date().toISOString()),
      })
      return { lastInsertRowId: id }
    }

    return { lastInsertRowId: nextId++ }
  },
}
