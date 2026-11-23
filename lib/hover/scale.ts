import type { AnchorKind, MetricTransform, ScaleAnchor } from './types.ts'

const FT_PER_M = 3.280839895013123
const MAX_RESIDUAL_IN = 1

const KIND_WEIGHTS: Record<AnchorKind, number> = {
  bar: 1.0,
  door: 0.8,
  garage: 0.8,
  wall: 0.5,
  footprint: 0.2,
  gps: 0.05,
}

export function canPublish(transform: MetricTransform): boolean {
  return transform.metricStatus === 'metric' && transform.scale !== null && transform.scale > 0
}

/**
 * Weighted least-squares scale from scene constraints. A placed scale bar dominates;
 * phone GPS is a weak prior, never truth. Residuals are expressed in inches so the
 * publish threshold is the same for every job.
 */
export function solveScale(
  anchors: ScaleAnchor[],
  measuredLengths: Record<string, number>,
  context: {
    manifestHash: string
    engineVersions: Record<string, string>
    reprojectionErrorPx?: number | null
  },
): MetricTransform {
  const usable = anchors.filter((anchor) => {
    const measured = measuredLengths[anchor.id]
    return Number.isFinite(anchor.observedValue) && anchor.observedValue > 0 &&
      Number.isFinite(measured) && measured > 0
  })

  const base = {
    anchorsUsed: usable.map((anchor) => anchor.id),
    gpsDownweighted: usable.some((anchor) => anchor.kind === 'gps'),
    reprojectionErrorPx: context.reprojectionErrorPx ?? null,
    engineVersions: context.engineVersions,
    manifestHash: context.manifestHash,
  }

  if (usable.length === 0) {
    return {
      ...base, scale: null, unit: 'ft', metricStatus: 'relative-only',
      residualsIn: [], disagreementIn: null,
    }
  }

  const observations = usable.map((anchor) => {
    const observedFt = anchor.unit === 'm' ? anchor.observedValue * FT_PER_M : anchor.observedValue
    const measured = measuredLengths[anchor.id]
    return {
      id: anchor.id,
      observedFt,
      measured,
      weight: KIND_WEIGHTS[anchor.kind] * Math.max(0.01, Math.min(1, anchor.confidence)),
    }
  })

  const totalWeight = observations.reduce((sum, item) => sum + item.weight, 0)
  const scale = observations.reduce(
    (sum, item) => sum + item.weight * (item.observedFt / item.measured), 0,
  ) / totalWeight
  const residualsIn = observations.map((item) =>
    Math.abs(item.observedFt - item.measured * scale) * 12,
  )
  const disagreementIn = residualsIn.length > 1
    ? Math.max(...residualsIn) - Math.min(...residualsIn)
    : 0
  const metricStatus = residualsIn.some((residual) => residual > MAX_RESIDUAL_IN) ? 'failed' : 'metric'

  return {
    ...base,
    scale,
    unit: 'ft',
    metricStatus,
    residualsIn,
    disagreementIn,
  }
}
