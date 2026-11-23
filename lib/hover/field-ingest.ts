/**
 * Pure server-side mappers for field-to-Hover ingest.
 *
 * Nothing here certifies a client GPS claim. `verifiedGpsInFile` is computed by
 * the ingest route after byte-verifying the private object, and that value is
 * the ONLY input allowed to set ScanImage.gpsInFile.
 */

import { createHash } from 'node:crypto'
import { classifySlot } from './capture.ts'
import { hashText } from './util.ts'
import type { ScanImage } from './types.ts'

export type InspectionPhotoRow = {
  id: string
  inspection_id: string
  workspace_id: string
  uploaded_by: string
  bucket_id: string | null
  object_path: string
  album: string | null
  hover_slot: string | null
  blur_score: number | null
  light_score: number | null
  captured_at: string | null
  gps_verified?: unknown
  gps_in_file?: unknown
  client_gps?: unknown
}

export type InspectionDraftRow = {
  id: string
  workspace_id: string
  created_by: string
}

export type IngestAnchorInput = {
  kind: string
  observedValue: number
  unit: string
  sourceImageId?: string | null
}

export type PhotoDigest = {
  sha256: string
  byteSize: number
}

/** Stable across retries; changes when any scale-defining field changes. */
export function anchorIdempotencyKey(workspaceId: string, draftId: string, anchor: IngestAnchorInput): string {
  return hashText(JSON.stringify({
    workspaceId,
    draftId,
    kind: anchor.kind,
    observedValue: anchor.observedValue,
    unit: anchor.unit,
  }))
}

/** Deterministic UUID so one draft maps to exactly one job, even on retries. */
export function uuidFromKey(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function newJobForDraft(draft: InspectionDraftRow): {
  workspace_id: string
  capture_mode: 'exterior'
  deliverable: 'full_exterior'
  sla_tier: 'visual-twin'
} {
  return {
    workspace_id: draft.workspace_id,
    capture_mode: 'exterior',
    deliverable: 'full_exterior',
    sla_tier: 'visual-twin',
  }
}

export function mapInspectionPhoto(
  photo: InspectionPhotoRow,
  verifiedGpsInFile: boolean,
  digest: PhotoDigest = { sha256: '', byteSize: 0 },
): ScanImage {
  const slot = classifySlot(photo.hover_slot)
  return {
    id: String(photo.id),
    jobId: '',
    workspaceId: photo.workspace_id,
    storagePath: photo.object_path,
    sha256: digest.sha256,
    byteSize: digest.byteSize,
    slot,
    role: slot ? 'model' : 'evidence',
    gpsInFile: verifiedGpsInFile === true,
    exif: null,
    blurScore: photo.blur_score ?? null,
    lightScore: photo.light_score ?? null,
    capturedAt: photo.captured_at ?? null,
  }
}
