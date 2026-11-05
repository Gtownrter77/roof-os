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
  technicianName: string | null
  technicianLicense: string | null
  verifiedAt: string | null
  verificationNotes: string | null
  verificationSynced: number
  updatedAt: string
}

type MeasurementRow = {
  id: number
  draftId: number
  clientId: string
  roofSquares: number
  gutterLf: number
  eaveLf: number
  rafterLf: number
  pitch: number
  soffitLf: number
  fasciaLf: number
  roofType: string
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
  caption: string | null
  mimeType: string
  fileSizeBytes: number | null
  width: number | null
  height: number | null
  capturedAt: string
  syncStatus: string
  remoteId: string | null
  error: string | null
  retryCount: number
  nextRetryAt: string | null
  lastError: string | null
}

type AiRequestRow = {
  id: number
  requestKey: string
  draftId: number
  photoQueueId: number
  featureKey: string
  status: string
  sourcePhotoId: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'roofos.field.local-db.v1'

type PersistedState = {
  drafts: DraftRow[]
  measurements: MeasurementRow[]
  photos: PhotoRow[]
  aiRequests: AiRequestRow[]
  nextId: number
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function restoreState(): PersistedState {
  const empty = { drafts: [] as DraftRow[], measurements: [] as MeasurementRow[], photos: [] as PhotoRow[], aiRequests: [] as AiRequestRow[], nextId: 1 }
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      measurements: Array.isArray(parsed.measurements) ? parsed.measurements : [],
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      aiRequests: Array.isArray(parsed.aiRequests) ? parsed.aiRequests : [],
      nextId: Number.isSafeInteger(parsed.nextId) && Number(parsed.nextId) > 0 ? Number(parsed.nextId) : 1,
    }
  } catch {
    return empty
  }
}

const restored = restoreState()
const drafts: DraftRow[] = restored.drafts
const measurements: MeasurementRow[] = restored.measurements
const photos: PhotoRow[] = restored.photos
const aiRequests: AiRequestRow[] = restored.aiRequests
let nextId = restored.nextId

function persistState() {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ drafts, measurements, photos, aiRequests, nextId }))
  } catch {
    throw new Error('Field data could not be saved in this browser. Free storage space and try again; this change may not survive a reload.')
  }
}

function nextRecordId() {
  return nextId++
}

function isReady(nextRetryAt: string | null, now: string) {
  return nextRetryAt === null || nextRetryAt <= now
}

let transactionDepth = 0

export function initLocalDb() {}

export const db = {
  execSync: (_sql: string) => undefined,

  withTransactionSync<T>(callback: () => T): T {
    const isOuterTransaction = transactionDepth === 0
    const snapshot = JSON.stringify({ drafts, measurements, photos, aiRequests, nextId })
    const restoreSnapshot = () => {
      const prior = JSON.parse(snapshot) as PersistedState
      drafts.splice(0, drafts.length, ...prior.drafts)
      measurements.splice(0, measurements.length, ...prior.measurements)
      photos.splice(0, photos.length, ...prior.photos)
      aiRequests.splice(0, aiRequests.length, ...prior.aiRequests)
      nextId = prior.nextId
    }
    transactionDepth += 1
    let result: T
    try {
      result = callback()
    } catch (error) {
      transactionDepth -= 1
      if (isOuterTransaction) {
        restoreSnapshot()
        persistState()
      }
      throw error
    }
    transactionDepth -= 1
    if (isOuterTransaction) {
      try {
        persistState()
      } catch (error) {
        restoreSnapshot()
        throw error
      }
    }
    return result
  },

  getFirstSync<T>(sql: string, ...args: unknown[]): T | null {
    if (sql.trimStart().startsWith('SELECT (')) {
      const draftId = Number(args[0])
      const queued = new Set(['queued', 'retrying'])
      const count = measurements.filter((row) => row.draftId === draftId && queued.has(row.syncStatus)).length
        + photos.filter((row) => row.draftId === draftId && queued.has(row.syncStatus)).length
      return { n: count } as T
    }
    const ownerUserId = typeof args[0] === 'string' ? args[0] : null
    const row = drafts
      .filter((draft) => draft.ownerUserId === ownerUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return (row as T | undefined) ?? null
  },

  getAllSync<T>(sql: string, ...args: unknown[]): T[] {
    if (sql.startsWith('SELECT id, remote_id as remoteId')) {
      const ownerUserId = typeof args[0] === 'string' ? args[0] : null
      return drafts
        .filter((draft) => draft.ownerUserId === ownerUserId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((draft) => ({ ...draft }) as T)
    }

    const draftId = Number(args[0])
    const firstStatus = String(args[1] ?? '')
    const secondStatus = String(args[2] ?? '')
    const now = String(args[3] ?? '')

    if (sql.startsWith('SELECT album FROM inspection_photo_queue')) {
      return photos.filter((row) => row.draftId === draftId).map((row) => ({ album: row.album }) as T)
    }

    if (sql.startsWith('SELECT roof_squares, gutter_lf, eave_lf')) {
      return measurements.filter((row) => row.draftId === draftId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0, 1).map((row) => ({ roof_squares: row.roofSquares, gutter_lf: row.gutterLf, eave_lf: row.eaveLf, rafter_lf: row.rafterLf, pitch: row.pitch, soffit_lf: row.soffitLf, fascia_lf: row.fasciaLf, roof_type: row.roofType }) as T)
    }

    if (sql.startsWith('SELECT retry_count FROM inspection_measurements_local')) {
      return measurements.filter((row) => row.draftId === draftId && (row.syncStatus === firstStatus || row.syncStatus === secondStatus)).map((row) => ({ retry_count: row.retryCount }) as T)
    }

    if (sql.startsWith('SELECT retry_count FROM inspection_photo_queue')) {
      return photos.filter((row) => row.draftId === draftId && (row.syncStatus === firstStatus || row.syncStatus === secondStatus)).map((row) => ({ retry_count: row.retryCount }) as T)
    }

    if (sql.startsWith('SELECT id, client_id, roof_squares, gutter_lf, eave_lf')) {
      return measurements
        .filter((row) => row.draftId === draftId && (row.syncStatus === firstStatus || row.syncStatus === secondStatus) && isReady(row.nextRetryAt, now))
        .map((row) => ({
          id: row.id,
          client_id: row.clientId,
          roof_squares: row.roofSquares,
          gutter_lf: row.gutterLf,
          eave_lf: row.eaveLf, rafter_lf: row.rafterLf, pitch: row.pitch, soffit_lf: row.soffitLf, fascia_lf: row.fasciaLf, roof_type: row.roofType,
          latitude: row.latitude,
          longitude: row.longitude,
          captured_at: row.capturedAt,
        }) as T)
    }

    if (sql.startsWith('SELECT id, client_id, local_uri, album, caption, mime_type')) {
      return photos
        .filter((row) => row.draftId === draftId && (row.syncStatus === firstStatus || row.syncStatus === secondStatus) && isReady(row.nextRetryAt, now))
        .map((row) => ({
          id: row.id,
          client_id: row.clientId,
          local_uri: row.localUri,
          album: row.album, caption: row.caption, mime_type: row.mimeType, file_size_bytes: row.fileSizeBytes, width: row.width, height: row.height,
          captured_at: row.capturedAt,
        }) as T)
    }

    if (sql.startsWith('SELECT id, local_uri, album, caption, sync_status, last_error')) {
      return photos
        .filter((row) => row.draftId === draftId)
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, 8)
        .map((row) => ({
          id: row.id,
          local_uri: row.localUri,
          album: row.album,
          caption: row.caption,
          sync_status: row.syncStatus,
          last_error: row.lastError,
          caption_ai_status: aiRequests.find((item) => item.photoQueueId === row.id && item.featureKey === 'caption_album')?.status ?? null,
          completeness_ai_status: aiRequests.find((item) => item.photoQueueId === row.id && item.featureKey === 'photo_completeness')?.status ?? null,
        }) as T)
    }

    return []
  },

  runSync(sql: string, ...args: unknown[]) {
    const result = this.runMutation(sql, ...args)
    if (transactionDepth === 0) persistState()
    return result
  },

  runMutation(sql: string, ...args: unknown[]) {
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
        technicianName: null,
        technicianLicense: null,
        verifiedAt: null,
        verificationNotes: null,
        verificationSynced: 0,
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

    if (sql.startsWith('UPDATE inspection_drafts SET technician_name')) {
      const [technicianName, technicianLicense, verifiedAt, verificationNotes, _verificationSynced, updatedAt, id] = args
      const row = drafts.find((draft) => draft.id === Number(id))
      if (row) {
        row.technicianName = typeof technicianName === 'string' ? technicianName : null
        row.technicianLicense = typeof technicianLicense === 'string' ? technicianLicense : null
        row.verifiedAt = typeof verifiedAt === 'string' ? verifiedAt : null
        row.verificationNotes = typeof verificationNotes === 'string' ? verificationNotes : null
        row.verificationSynced = 0
        row.updatedAt = String(updatedAt ?? row.updatedAt)
      }
      return { lastInsertRowId: Number(id) || 0 }
    }

    if (sql.startsWith('UPDATE inspection_drafts SET verification_synced = 1')) {
      const row = drafts.find((draft) => draft.id === Number(args[0]))
      if (row) row.verificationSynced = 1
      return { lastInsertRowId: Number(args[0]) || 0 }
    }

    if (sql.startsWith('INSERT INTO inspection_measurements_local')) {
      const id = nextRecordId()
      measurements.push({
        id,
        draftId: Number(args[0]),
        clientId: String(args[1]),
        roofSquares: Number(args[2]),
        gutterLf: Number(args[3]),
        eaveLf: Number(args[4]), rafterLf: Number(args[5]), pitch: Number(args[6]), soffitLf: Number(args[7]), fasciaLf: Number(args[8]), roofType: String(args[9]),
        latitude: args[10] == null ? null : Number(args[10]),
        longitude: args[11] == null ? null : Number(args[11]),
        capturedAt: String(args[12]),
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
        caption: args[4] == null ? null : String(args[4]), mimeType: String(args[5] ?? 'image/jpeg'), fileSizeBytes: args[6] == null ? null : Number(args[6]), width: args[7] == null ? null : Number(args[7]), height: args[8] == null ? null : Number(args[8]),
        capturedAt: String(args[9]),
        syncStatus: 'queued',
        remoteId: null,
        error: null,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
      })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('INSERT OR IGNORE INTO inspection_ai_request_queue')) {
      const [requestKey, draftId, photoQueueId, featureKey, status, sourcePhotoId, expiresAt, createdAt, updatedAt] = args
      const existing = aiRequests.find((row) => row.requestKey === String(requestKey) || (row.photoQueueId === Number(photoQueueId) && row.featureKey === String(featureKey)))
      if (existing) return { lastInsertRowId: existing.id }
      const id = nextRecordId()
      aiRequests.push({ id, requestKey: String(requestKey), draftId: Number(draftId), photoQueueId: Number(photoQueueId), featureKey: String(featureKey), status: String(status), sourcePhotoId: typeof sourcePhotoId === 'string' ? sourcePhotoId : null, expiresAt: String(expiresAt), createdAt: String(createdAt), updatedAt: String(updatedAt) })
      return { lastInsertRowId: id }
    }

    if (sql.startsWith('UPDATE inspection_ai_request_queue SET status = ?, source_photo_id')) {
      const [status, sourcePhotoId, updatedAt, photoQueueId, previousStatus] = args
      for (const row of aiRequests) {
        if (row.photoQueueId === Number(photoQueueId) && row.status === String(previousStatus)) {
          row.status = String(status)
          row.sourcePhotoId = typeof sourcePhotoId === 'string' ? sourcePhotoId : null
          row.updatedAt = String(updatedAt)
        }
      }
      return { lastInsertRowId: 0 }
    }

    if (sql.startsWith('DELETE FROM inspection_ai_request_queue WHERE feature_key')) {
      const featureKey = String(args[0])
      for (let index = aiRequests.length - 1; index >= 0; index--) {
        if (aiRequests[index].featureKey === featureKey) aiRequests.splice(index, 1)
      }
      return { lastInsertRowId: 0 }
    }

    if (sql.startsWith('DELETE FROM inspection_ai_request_queue WHERE expires_at')) {
      const now = String(args[0])
      for (let index = aiRequests.length - 1; index >= 0; index--) {
        if (aiRequests[index].expiresAt <= now) aiRequests.splice(index, 1)
      }
      return { lastInsertRowId: 0 }
    }

    if (sql.startsWith('UPDATE inspection_ai_request_queue SET expires_at')) {
      const [expiresAt, updatedAt, firstStatus, secondStatus] = args
      for (const row of aiRequests) {
        if (row.status === String(firstStatus) || row.status === String(secondStatus)) {
          row.expiresAt = String(expiresAt)
          row.updatedAt = String(updatedAt)
        }
      }
      return { lastInsertRowId: 0 }
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
