import { uuid } from './util.ts'
import type { InputManifest, MetricStatus, ReconstructionRecord, Vec3 } from './types.ts'

export function inferReconstruction(
  manifest: InputManifest,
  points: Vec3[],
  options: {
    id?: string
    engineVersions?: Record<string, string>
    meshUrl?: string | null
    splatUrl?: string | null
    metricStatus?: MetricStatus
    reprojectionErrorPx?: number | null
  } = {},
): ReconstructionRecord {
  return {
    id: options.id ?? uuid(),
    jobId: manifest.jobId,
    workspaceId: manifest.workspaceId,
    manifestHash: manifest.manifestHash,
    engineVersions: options.engineVersions ?? {},
    meshUrl: options.meshUrl ?? null,
    splatUrl: options.splatUrl ?? null,
    metricStatus: options.metricStatus ?? 'relative-only',
    reprojectionErrorPx: options.reprojectionErrorPx ?? null,
    points,
  }
}
