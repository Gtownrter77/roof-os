// Deterministic roof tracing geometry. These values represent plan/ground area only.
// Coordinates are either image [y,x] pixels or geodetic [latitude,longitude] degrees.
export type TracePoint = [number, number]
export type TraceUnits = 'pixels' | 'geographic'
export type TraceResult = { area: number; perimeter: number; unit: 'px2' | 'sqft'; perimeterUnit: 'px' | 'ft'; warning: string | null; valid: boolean }
const M_TO_FT = 3.280839895013123
const EARTH_RADIUS_METERS = 6371008.8
const EPS = 1e-9

function cross(a: TracePoint, b: TracePoint, c: TracePoint): number {
  return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
}
function between(a: number, b: number, x: number): boolean {
  return x >= Math.min(a, b) - EPS && x <= Math.max(a, b) + EPS
}
function onSegment(a: TracePoint, b: TracePoint, c: TracePoint): boolean {
  return Math.abs(cross(a, b, c)) <= EPS &&
    between(a[0], b[0], c[0]) && between(a[1], b[1], c[1])
}
function segmentsIntersect(a: TracePoint, b: TracePoint, c: TracePoint, d: TracePoint): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d)
  const cdA = cross(c, d, a), cdB = cross(c, d, b)
  if ((abC > EPS && abD < -EPS || abC < -EPS && abD > EPS) &&
    (cdA > EPS && cdB < -EPS || cdA < -EPS && cdB > EPS)) return true
  return onSegment(a, b, c) || onSegment(a, b, d) ||
    onSegment(c, d, a) || onSegment(c, d, b)
}
function validateSimplePolygon(coords: TracePoint[]): string | null {
  if (!Array.isArray(coords) || coords.length < 3) return 'Add at least three corners.'
  if (coords.length > 200) return 'Too many corners; maximum is 200 per roof plane.'
  if (coords.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) return 'Invalid corner coordinates.'
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const a = coords[i], b = coords[(i + 1) % n]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPS) return 'Two adjacent corners overlap.'
    for (let j = i + 1; j < n; j++) {
      // Neighboring edges legitimately share a vertex.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue
      if (segmentsIntersect(a, b, coords[j], coords[(j + 1) % n])) return 'Roof plane crosses itself. Undo and retrace its corners.'
    }
  }
  return null
}
export function analyzeTracedPolygon(points: TracePoint[], units: TraceUnits): TraceResult {
  const blank = (warning: string): TraceResult => ({
    area: 0, perimeter: 0, unit: units === 'pixels' ? 'px2' : 'sqft',
    perimeterUnit: units === 'pixels' ? 'px' : 'ft', valid: false, warning,
  })
  if (units !== 'pixels' && units !== 'geographic') return blank('Unsupported trace coordinate system.')
  const error = validateSimplePolygon(points)
  if (error) return blank(error)
  let coords: TracePoint[] = points
  if (units === 'geographic') {
    if (points.some(([lat, lon]) => Math.abs(lat) > 85 || Math.abs(lon) > 180)) return blank('Invalid geographic coordinates.')
    const latitude = points.reduce((a, p) => a + p[0], 0) / points.length * Math.PI / 180
    const longitude = points.reduce((a, p) => a + p[1], 0) / points.length * Math.PI / 180
    coords = points.map(([lat, lon]) => [
      (lat * Math.PI / 180 - latitude) * EARTH_RADIUS_METERS,
      (lon * Math.PI / 180 - longitude) * EARTH_RADIUS_METERS * Math.cos(latitude),
    ])
    // Reject large map traces where planar local approximation becomes unreliable.
    const latSpread = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]))
    const lonSpread = Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]))
    if (latSpread > 0.02 || lonSpread > 0.02) return blank('Map trace is too large for a single roof plane.')
  }
  let twiceArea = 0, perimeter = 0
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i], b = coords[(i + 1) % coords.length]
    twiceArea += a[1] * b[0] - b[1] * a[0]
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const factor = units === 'geographic' ? M_TO_FT * M_TO_FT : 1
  const area = Math.abs(twiceArea) / 2 * factor
  const perimeterValue = perimeter * (units === 'geographic' ? M_TO_FT : 1)
  if (!Number.isFinite(area) || !Number.isFinite(perimeterValue) || area <= EPS ||
    (units === 'geographic' && area > 20_000_000)) return blank('The polygon does not enclose a usable roof footprint.')
  return { area, perimeter: perimeterValue, unit: units === 'pixels' ? 'px2' : 'sqft',
    perimeterUnit: units === 'pixels' ? 'px' : 'ft', valid: true, warning: null }
}

// Cross-plane checks operate in one Cartesian frame. For geographic points,
// use one shared local projection; otherwise adjacent facets may get
// different origins and appear to have a gap.
function projectedPlanes(planes: TracePoint[][], units: TraceUnits): TracePoint[][] {
  if (units === 'pixels') return planes
  const points = planes.flat()
  const centerLat = points.reduce((sum, p) => sum + p[0], 0) / points.length * Math.PI / 180
  const centerLon = points.reduce((sum, p) => sum + p[1], 0) / points.length * Math.PI / 180
  return planes.map(plane => plane.map(([lat, lon]) => [
    (lat * Math.PI / 180 - centerLat) * EARTH_RADIUS_METERS,
    (lon * Math.PI / 180 - centerLon) * EARTH_RADIUS_METERS * Math.cos(centerLat),
  ]))
}

function signedDoubleArea(points: TracePoint[]): number {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + p[0] * q[1] - q[0] * p[1]
  }, 0)
}

function locationOfPoint(point: TracePoint, polygon: TracePoint[]): -1 | 0 | 1 {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i]
    if (onSegment(a, b, point)) return 0
    if ((a[1] > point[1]) !== (b[1] > point[1])) {
      const intersectionX = a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
      if (intersectionX > point[0]) inside = !inside
    }
  }
  return inside ? 1 : -1
}

function strictlyCross(a: TracePoint, b: TracePoint, c: TracePoint, d: TracePoint): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d)
  const cdA = cross(c, d, a), cdB = cross(c, d, b)
  return ((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
    ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))
}

function sharedSegmentLength(a: TracePoint, b: TracePoint, c: TracePoint, d: TracePoint): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const length = Math.hypot(dx, dy)
  if (length <= EPS ||
    Math.abs(cross(a, b, c)) / length > EPS ||
    Math.abs(cross(a, b, d)) / length > EPS) return 0
  const t0 = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (length * length)
  const t1 = ((d[0] - a[0]) * dx + (d[1] - a[1]) * dy) / (length * length)
  return Math.max(0, Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1))) * length
}

function comparePlanePair(first: TracePoint[], second: TracePoint[]): { overlaps: boolean; shared: number } {
  let shared = 0
  const firstOrientation = Math.sign(signedDoubleArea(first))
  const secondOrientation = Math.sign(signedDoubleArea(second))
  for (let i = 0; i < first.length; i++) {
    const a = first[i], b = first[(i + 1) % first.length]
    for (let j = 0; j < second.length; j++) {
      const c = second[j], d = second[(j + 1) % second.length]
      if (strictlyCross(a, b, c, d)) return { overlaps: true, shared: 0 }
      const common = sharedSegmentLength(a, b, c, d)
      if (common > EPS) {
        // Two polygons on the SAME side of a coincident edge overlap.
        // Opposite interior sides are legitimate roof-plane neighbors.
        const dot = (b[0] - a[0]) * (d[0] - c[0]) +
          (b[1] - a[1]) * (d[1] - c[1])
        if (dot * firstOrientation * secondOrientation > 0) return { overlaps: true, shared: 0 }
        shared += common
      }
    }
  }
  // Catches containment, staggered overlap, and boundaries meeting at corners.
  for (const [candidate, container] of [[first, second], [second, first]] as const) {
    for (let i = 0; i < candidate.length; i++) {
      const a = candidate[i], b = candidate[(i + 1) % candidate.length]
      if (locationOfPoint(a, container) === 1 ||
        locationOfPoint([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], container) === 1) {
        return { overlaps: true, shared: 0 }
      }
    }
  }
  return { overlaps: false, shared }
}

export type PlaneAggregate = { area: number; perimeter: number; planeCount: number; valid: boolean; warning: string | null }
export function aggregateTracePlanes(planes: TracePoint[][], units: TraceUnits): PlaneAggregate {
  if (!Array.isArray(planes) || planes.length > 50) return { area: 0, perimeter: 0, planeCount: 0, valid: false, warning: 'Maximum of 50 planes per draft.' }
  const invalid = (warning: string | null): PlaneAggregate => ({
    area: 0, perimeter: 0, planeCount: planes.length, valid: false, warning,
  })
  if (!planes.length) return invalid('Trace and finish at least one plane.')
  let area = 0, perimeter = 0
  for (const plane of planes) {
    const result = analyzeTracedPolygon(plane, units)
    if (!result.valid) return invalid(result.warning)
    area += result.area; perimeter += result.perimeter
  }
  const projected = projectedPlanes(planes, units)
  let internalEdge = 0
  for (let i = 0; i < projected.length; i++) {
    for (let j = i + 1; j < projected.length; j++) {
      const comparison = comparePlanePair(projected[i], projected[j])
      if (comparison.overlaps) return invalid('Roof planes overlap. Move or remove a plane before accepting quantities.')
      internalEdge += comparison.shared
    }
  }
  // Every shared boundary occurs in the perimeter of BOTH polygons.
  // The result is only the plan-view external trace, not certified eave length.
  const unitFactor = units === 'geographic' ? M_TO_FT : 1
  perimeter -= 2 * internalEdge * unitFactor
  if (perimeter < -EPS || !Number.isFinite(perimeter)) return invalid('Invalid shared roof-plane boundaries.')
  return { area, perimeter: Math.max(0, perimeter), planeCount: planes.length, valid: true, warning: null }
}
