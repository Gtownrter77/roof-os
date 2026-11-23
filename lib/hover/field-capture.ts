/**
 * Pure mappers from offline field rows to the merged Hover capture contract.
 *
 * The placeholder ids/paths below are for ON-DEVICE validation only. The server
 * replaces them with database ids, object-storage paths and byte-verified GPS
 * status during ingest; nothing here is published as a measurement.
 */

import type { AnchorKind, ScanImage, ScaleAnchor, SlotId } from './types.ts'

export type FieldPhotoRow = {
  id: number
  draftId: number
  localUri: string
  album: string
  hoverSlot: string | null
  gpsVerified: number | null
  blurScore: number | null
  lightScore: number | null
  capturedAt: string
  supersededAt: string | null
}

export type FieldAnchorRow = {
  id: number
  draftId: number
  clientId: string
  kind: string
  observedValue: number
  unit: string
  capturedAt: string
}

const LOCAL_SCOPE = 'local'

export function toScanImages(rows: FieldPhotoRow[]): ScanImage[] {
  return rows
    .filter((row) => row.album === 'model' && row.supersededAt === null)
    .map((row) => ({
      id: String(row.id),
      jobId: LOCAL_SCOPE,
      workspaceId: LOCAL_SCOPE,
      storagePath: row.localUri,
      sha256: '',
      byteSize: 0,
      slot: (row.hoverSlot as SlotId | null) ?? null,
      role: 'model',
      gpsInFile: row.gpsVerified === 1,
      exif: null,
      blurScore: row.blurScore ?? null,
      lightScore: row.lightScore ?? null,
      capturedAt: row.capturedAt,
    }))
}

export function toScaleAnchors(rows: FieldAnchorRow[]): ScaleAnchor[] {
  return rows.map((row) => ({
    id: row.clientId,
    jobId: LOCAL_SCOPE,
    kind: row.kind as AnchorKind,
    observedValue: row.observedValue,
    unit: row.unit as 'ft' | 'm',
    sourceImageId: null,
    confidence: 1,
  }))
}
