import type { Vec3 } from './types.ts'

function newell(vertices: Vec3[]): Vec3 {
  let x = 0, y = 0, z = 0
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    x += (a.y - b.y) * (a.z + b.z)
    y += (a.z - b.z) * (a.x + b.x)
    z += (a.x - b.x) * (a.y + b.y)
  }
  return { x, y, z }
}

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

export function fitPlane(points: Vec3[]): { normal: Vec3; d: number } | null {
  if (!Array.isArray(points) || points.length < 3) return null
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z))) return null
  const normalVector = newell(points)
  const size = magnitude(normalVector)
  if (size < 1e-9) return null
  const normal = {
    x: normalVector.x / size,
    y: normalVector.y / size,
    z: normalVector.z / size,
  }
  const centroid = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length, z: acc.z + point.z / points.length }),
    { x: 0, y: 0, z: 0 },
  )
  const d = -(normal.x * centroid.x + normal.y * centroid.y + normal.z * centroid.z)
  return { normal, d }
}

export function polygonArea(vertices: Vec3[]): number {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0
  return magnitude(newell(vertices)) / 2
}

export function pitchFromNormal(normal: Vec3): number {
  const cosine = Math.min(1, Math.max(-1, Math.abs(normal.z)))
  return Math.acos(cosine) * 180 / Math.PI
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}
