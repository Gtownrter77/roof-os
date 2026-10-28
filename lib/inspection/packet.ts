// Deterministic inspection evidence packet.
//
// Everything in this file is derived from stored rows. It never infers damage,
// coverage, measurements or approval. It never builds a public URL.

export type InspectionSessionRow = {
  id: string
  workspace_id: string
  lead_id: string | null
  status: string
  started_at: string
  completed_at: string | null
}

export type InspectionPhotoRow = {
  id: string
  album: string
  caption: string | null
  mime_type: string
  file_size_bytes: number | null
  width: number | null
  height: number | null
  captured_at: string | null
  upload_status: string
  object_path: string
}

export type InspectionMeasurementRow = {
  id: string
  source_type: string
  confidence: string
  source_reference: string | null
  captured_at: string
  roof_area_sqft: number | string | null
  roof_squares: number | string | null
  gutter_lf: number | string | null
  ridge_lf: number | string | null
  eave_lf: number | string | null
  rake_lf: number | string | null
  valley_lf: number | string | null
  rafter_lf: number | string | null
  soffit_lf: number | string | null
  fascia_lf: number | string | null
  pitch: string | null
  roof_type: string | null
}

export type Agent3Output = {
  issue_count?: number
  issues?: string[]
} | null

export type ChecklistStatus = 'pass' | 'review' | 'missing'
export type ChecklistItem = { key: string; label: string; status: ChecklistStatus; detail: string }

export type InspectionPacket = {
  packetVersion: 'inspection-packet-v1'
  generatedAt: string
  inspection: { id: string; leadId: string | null; status: string; startedAt: string; completedAt: string | null }
  privacy: { storageBucket: 'inspection-photos'; publicAccess: false; urlsIncluded: false; note: string }
  photos: Array<{
    id: string
    album: string
    caption: string | null
    mimeType: string
    fileSizeBytes: number | null
    width: number | null
    height: number | null
    capturedAt: string | null
    uploadStatus: string
    hasCaption: boolean
    objectPath: string
  }>
  albumCounts: Record<string, number>
  measurements: Array<{
    id: string
    sourceType: string
    confidence: string
    sourceReference: string | null
    capturedAt: string
    values: Record<string, number | string>
  }>
  agent3: { reviewed: boolean; issueCount: number; issues: string[] }
  checklist: ChecklistItem[]
  blockingIssues: string[]
  reviewItems: string[]
  readyForReview: boolean
}

const MEASUREMENT_KEYS = [
  'roof_area_sqft',
  'roof_squares',
  'gutter_lf',
  'ridge_lf',
  'eave_lf',
  'rake_lf',
  'valley_lf',
  'rafter_lf',
  'soffit_lf',
  'fascia_lf',
] as const

function statedNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function buildInspectionPacket(input: {
  inspection: InspectionSessionRow
  photos: InspectionPhotoRow[]
  measurements: InspectionMeasurementRow[]
  agent3Output?: Agent3Output
  now?: string
}): InspectionPacket {
  const { inspection, photos, measurements } = input
  const now = input.now ?? new Date().toISOString()

  const albumCounts: Record<string, number> = {}
  for (const photo of photos) {
    albumCounts[photo.album] = (albumCounts[photo.album] ?? 0) + 1
  }

  const packetPhotos = photos.map((photo) => ({
    id: photo.id,
    album: photo.album,
    caption: photo.caption,
    mimeType: photo.mime_type,
    fileSizeBytes: photo.file_size_bytes,
    width: photo.width,
    height: photo.height,
    capturedAt: photo.captured_at,
    uploadStatus: photo.upload_status,
    hasCaption: Boolean(photo.caption?.trim()),
    objectPath: photo.object_path,
  }))

  const packetMeasurements = measurements.map((row) => {
    const values: Record<string, number | string> = {}
    for (const key of MEASUREMENT_KEYS) {
      const parsed = statedNumber(row[key])
      if (parsed !== null) values[key] = parsed
    }
    if (row.pitch?.trim()) values.pitch = row.pitch.trim()
    if (row.roof_type?.trim()) values.roof_type = row.roof_type.trim()
    return {
      id: row.id,
      sourceType: row.source_type,
      confidence: row.confidence,
      sourceReference: row.source_reference,
      capturedAt: row.captured_at,
      values,
    }
  })

  const agent3 = {
    reviewed: Boolean(input.agent3Output),
    issueCount: typeof input.agent3Output?.issue_count === 'number' ? input.agent3Output.issue_count : 0,
    issues: input.agent3Output?.issues ?? [],
  }

  const notUploaded = photos.filter((photo) => photo.upload_status !== 'uploaded')
  const uncaptioned = photos.filter((photo) => !photo.caption?.trim())
  const seenPaths = new Set<string>()
  const duplicatePaths: string[] = []
  for (const photo of photos) {
    if (seenPaths.has(photo.object_path)) duplicatePaths.push(photo.object_path)
    seenPaths.add(photo.object_path)
  }
  const unverified = measurements.filter((row) => row.confidence === 'unverified')

  const checklist: ChecklistItem[] = [
    {
      key: 'inspection_completed',
      label: 'Inspection completed',
      status: inspection.status === 'completed' ? 'pass' : 'missing',
      detail: inspection.status === 'completed'
        ? 'Session is completed.'
        : `Session status is ${inspection.status}. Complete it before review.`,
    },
    {
      key: 'photos_present',
      label: 'Photographic evidence present',
      status: photos.length > 0 ? 'pass' : 'missing',
      detail: photos.length > 0 ? `${photos.length} photo${photos.length === 1 ? '' : 's'} recorded.` : 'No photos recorded.',
    },
    {
      key: 'uploads_complete',
      label: 'All photos uploaded',
      status: notUploaded.length === 0 ? 'pass' : 'review',
      detail: notUploaded.length === 0
        ? 'Every photo finished uploading.'
        : `${notUploaded.length} photo${notUploaded.length === 1 ? '' : 's'} not uploaded yet.`,
    },
    {
      key: 'captions_present',
      label: 'Every photo has a caption',
      status: uncaptioned.length === 0 ? 'pass' : 'review',
      detail: uncaptioned.length === 0
        ? 'Every photo carries a caption.'
        : `${uncaptioned.length} photo${uncaptioned.length === 1 ? '' : 's'} without a caption.`,
    },
    {
      key: 'unique_objects',
      label: 'No duplicate photo objects',
      status: duplicatePaths.length === 0 ? 'pass' : 'missing',
      detail: duplicatePaths.length === 0
        ? 'Each stored object appears once.'
        : `${duplicatePaths.length} duplicate object path${duplicatePaths.length === 1 ? '' : 's'}.`,
    },
    {
      key: 'measurements_present',
      label: 'Measurements recorded',
      status: measurements.length > 0 ? 'pass' : 'review',
      detail: measurements.length > 0
        ? `${measurements.length} measurement row${measurements.length === 1 ? '' : 's'}.`
        : 'No measurement rows for this inspection.',
    },
    {
      key: 'measurement_provenance',
      label: 'Measurement provenance is marked',
      status: measurements.length === 0 ? 'review' : unverified.length === 0 ? 'pass' : 'review',
      detail: measurements.length === 0
        ? 'Nothing to check until a measurement exists.'
        : unverified.length === 0
          ? 'Every measurement has a reviewed confidence level.'
          : `${unverified.length} measurement${unverified.length === 1 ? '' : 's'} still marked unverified.`,
    },
    {
      key: 'agent3_review',
      label: 'Agent 3 evidence review',
      status: agent3.reviewed ? (agent3.issueCount === 0 ? 'pass' : 'review') : 'review',
      detail: agent3.reviewed
        ? agent3.issueCount === 0
          ? 'Agent 3 reported no evidence issues.'
          : `Agent 3 reported ${agent3.issueCount} issue${agent3.issueCount === 1 ? '' : 's'}.`
        : 'Agent 3 has not reviewed this inspection yet.',
    },
  ]

  const blockingIssues = checklist.filter((item) => item.status === 'missing').map((item) => item.key)
  const reviewItems = checklist.filter((item) => item.status === 'review').map((item) => item.key)

  return {
    packetVersion: 'inspection-packet-v1',
    generatedAt: now,
    inspection: {
      id: inspection.id,
      leadId: inspection.lead_id,
      status: inspection.status,
      startedAt: inspection.started_at,
      completedAt: inspection.completed_at,
    },
    privacy: {
      storageBucket: 'inspection-photos',
      publicAccess: false,
      urlsIncluded: false,
      note: 'Photos stay in the private bucket. The review page signs short-lived URLs for members only.',
    },
    photos: packetPhotos,
    albumCounts,
    measurements: packetMeasurements,
    agent3,
    checklist,
    blockingIssues,
    reviewItems,
    readyForReview: blockingIssues.length === 0,
  }
}
