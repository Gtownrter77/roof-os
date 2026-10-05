type DraftRow = {
  id: number
  remoteId: string | null
  ownerUserId: string | null
  workspaceId: string | null
  clientId: string | null
  leadId: string | null
  address: string
  photoCount: number
  status: string
  latitude: number | null
  longitude: number | null
  updatedAt: string
}

type MeasurementRow = {
  id: number
  draftId: number
  clientId: string
  roofSquares: number
  gutterLf: number
  latitude: number | null
  longitude: number | null
  capturedAt: string
  syncStatus: string
  retryCount: number
  nextRetryAt: string | null
  lastError: string | null
}

type PhotoRow = {
  id: number
  draftId: number
  clientId: string
  localUri: string
  album: string
  capturedAt: string
  syncStatus: string
  remoteId: string | null
  error: string | null
  retryCount: number
  nextRetryAt: string | null
  lastError: string | null
}

const drafts: DraftRow[] = []
const measurements: MeasurementRow[] = []
const photos: PhotoRow[] = []
let nextId = 1

function nextRecordId() {
  return nextId++
}

function isReady(nextRetryAt: string | null, now: string) {
  return nextRetryAt === null || nextRetryAt <= now
}

export const db = {
  execSync: (_sql: string) => undefined,

  getFirstSync<T>(_sql: string, ...args: unknown[]): T | null {
    const ownerUserId = typeof args[0] === 'string' ? args[0] : null
    const row = drafts
      .filter((draft) => draft.ownerUserId === ownerUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return (row as T | undefined) ?? null
  },

  getAllSync<T>(sql: string, ...args: unknown[]): T[] {
    const draftId = Number(args[0])
    const firstStatus = String(args[1] ?? '')
    const secondStatus = String(args[2] ?? '')
    const now = String(args[3] ?? '')

    if (sql.startsWith('SELECT id, client_id, roof_squares, gutter_lf')) {
      return measurements
        .filter((row) => row.draftId === draftId && (row.syncStatus === firstStatus || row.syncStatus === secondStatus) && isReady(row.nextRetryAt, now))
        .map((row) => ({
          id: row.id,
          client_id: row.clientId,
          roof_squares: row.roofSquares,
          gutter_lf: row.gutterLf,
          latitude: row.latitude,
          longitude: row.longitude,
          captured_at: row.capturedAt,
        }) as T)
    }

    if (sql.startsWith('SELECT id, client_id, local_uri, album, captured_at')) {
      return photos
        .filter((row) => row.draftId === draftId && (row.syncStatus === firstStatus || row.syncStatus === secondStatus) && isReady(row.nextRetryAt, now))
        .map((row) => ({
          id: row.id,
          client_id: row.clientId,
          local_uri: row.localUri,
          album: row.album,
          captured_at: row.capturedAt,
        }) as T)
    }

    return []
  },

  runSync(sql: string, ...args: unknown[]) {
    if (sql.startsWith('INSERT INTO inspection_drafts')) {
      const id = nextRecordId()
      drafts.unshift({
        id,
        remoteId: null,
        ownerUserId: typeof args[0] === 'string' ? args[0] : null,
        workspaceId: typeof args[1] === 'string' ? args[1] : null,
        clientId: typeof args[2] === 'string' ? args[2] : null,
        leadId: typeof args[3] === 'string' ? args[3] : null,
        address: String(args[4] ?? ''),
        photoCount: Number(args[5] ?? 0),
        status: String(args[6] ?? 'draft'),
        latitude: args[7] == null ? null : Number(args[7]),
        longitude: args[8] == null ? null : Number(args[8]),
        updatedAt: String(args[9] ?? new Date(0).toISOString()),
      })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('UPDATE inspection_drafts SET lead_id')) {
      const [leadId, address, photoCount, latitude, longitude, updatedAt, id] = args
      const row = drafts.find((draft) => draft.id === Number(id))
      if (row) {
        row.leadId = typeof leadId === 'string' ? leadId : null
        row.address = String(address ?? '')
        row.photoCount = Number(photoCount ?? 0)
        row.latitude = latitude == null ? null : Number(latitude)
        row.longitude = longitude == null ? null : Number(longitude)
        row.updatedAt = String(updatedAt ?? row.updatedAt)
      }
      return { lastInsertRowId: Number(id) || 0 }
    }

    if (sql.startsWith('UPDATE inspection_drafts SET remote_id')) {
      const [remoteId, workspaceId, id] = args
      const row = drafts.find((draft) => draft.id === Number(id))
      if (row) {
        row.remoteId = typeof remoteId === 'string' ? remoteId : null
        row.workspaceId = typeof workspaceId === 'string' ? workspaceId : null
      }
      return { lastInsertRowId: Number(id) || 0 }
    }

    if (sql.startsWith('INSERT INTO inspection_measurements_local')) {
      const id = nextRecordId()
      measurements.push({
        id,
        draftId: Number(args[0]),
        clientId: String(args[1]),
        roofSquares: Number(args[2]),
        gutterLf: Number(args[3]),
        latitude: args[4] == null ? null : Number(args[4]),
        longitude: args[5] == null ? null : Number(args[5]),
        capturedAt: String(args[6]),
        syncStatus: 'queued',
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
      })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('UPDATE inspection_measurements_local SET sync_status = ?, last_error = NULL')) {
      const [syncStatus, id] = args
      const row = measurements.find((measurement) => measurement.id === Number(id))
      if (row) {
        row.syncStatus = String(syncStatus)
        row.lastError = null
        row.nextRetryAt = null
      }
      return { lastInsertRowId: Number(id) || 0 }
    }

    if (sql.startsWith('UPDATE inspection_measurements_local SET sync_status = ?, retry_count = retry_count + 1')) {
      const [syncStatus, nextRetryAt, lastError, draftId, firstStatus, secondStatus] = args
      for (const row of measurements) {
        if (row.draftId === Number(draftId) && (row.syncStatus === String(firstStatus) || row.syncStatus === String(secondStatus))) {
          row.syncStatus = String(syncStatus)
          row.retryCount += 1
          row.nextRetryAt = String(nextRetryAt)
          row.lastError = String(lastError)
        }
      }
      return { lastInsertRowId: 0 }
    }

    if (sql.startsWith('INSERT INTO inspection_photo_queue')) {
      const id = nextRecordId()
      photos.push({
        id,
        draftId: Number(args[0]),
        clientId: String(args[1]),
        localUri: String(args[2]),
        album: String(args[3] ?? 'general'),
        capturedAt: String(args[4]),
        syncStatus: 'queued',
        remoteId: null,
        error: null,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
      })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('UPDATE inspection_photo_queue SET sync_status = ?, remote_id')) {
      const [syncStatus, remoteId, id] = args
      const row = photos.find((photo) => photo.id === Number(id))
      if (row) {
        row.syncStatus = String(syncStatus)
        row.remoteId = typeof remoteId === 'string' ? remoteId : null
        row.lastError = null
        row.error = null
        row.nextRetryAt = null
      }
      return { lastInsertRowId: Number(id) || 0 }
    }

    if (sql.startsWith('UPDATE inspection_photo_queue SET sync_status = ?, retry_count = retry_count + 1')) {
      const [syncStatus, nextRetryAt, lastError, error, draftId, firstStatus, secondStatus] = args
      for (const row of photos) {
        if (row.draftId === Number(draftId) && (row.syncStatus === String(firstStatus) || row.syncStatus === String(secondStatus))) {
          row.syncStatus = String(syncStatus)
          row.retryCount += 1
          row.nextRetryAt = String(nextRetryAt)
          row.lastError = String(lastError)
          row.error = String(error)
        }
      }
      return { lastInsertRowId: 0 }
    }

    return { lastInsertRowId: nextRecordId() }
  },
}
