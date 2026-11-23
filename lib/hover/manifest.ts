import { validateCapture } from './capture.ts'
import { hashText } from './util.ts'
import type { InputManifest, ScaleAnchor, ScanImage, ScanJob } from './types.ts'

type ManifestBase = Omit<InputManifest, 'manifestHash'>

/** Canonical bytes: sorted, stable, and independent of row order. The hash is never part of them. */
export function canonicalManifest(base: ManifestBase): string {
  const images = [...base.images]
    .sort((a, b) => a.sha256.localeCompare(b.sha256) || a.id.localeCompare(b.id))
    .map((image) => ({
      id: image.id,
      sha256: image.sha256,
      byteSize: image.byteSize,
      storagePath: image.storagePath,
      slot: image.slot,
      role: image.role,
      gpsInFile: image.gpsInFile,
      exif: image.exif,
      capturedAt: image.capturedAt,
    }))
  const anchors = [...base.anchors]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((anchor) => ({
      id: anchor.id,
      kind: anchor.kind,
      observedValue: anchor.observedValue,
      unit: anchor.unit,
      sourceImageId: anchor.sourceImageId,
      confidence: anchor.confidence,
    }))
  return JSON.stringify({
    jobId: base.jobId,
    workspaceId: base.workspaceId,
    createdAt: base.createdAt,
    images,
    anchors,
  })
}

export function buildInputManifest(
  job: ScanJob,
  images: ScanImage[],
  anchors: ScaleAnchor[],
): InputManifest {
  const capture = validateCapture(images, anchors)
  if (!capture.complete) {
    throw new Error(`capture incomplete: ${capture.reason ?? 'unknown reason'}`)
  }
  const base: ManifestBase = {
    jobId: job.id,
    workspaceId: job.workspaceId,
    images,
    anchors: capture.anchorsAccepted,
    createdAt: job.createdAt,
  }
  return { ...base, manifestHash: hashText(canonicalManifest(base)) }
}

export function verifyManifest(manifest: InputManifest): boolean {
  return hashText(canonicalManifest(manifest)) === manifest.manifestHash
}
