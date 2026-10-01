export const GEOMETRY_CONTRACT_VERSION = '1.0.0' as const
export const GEOMETRY_CONFIDENCES = ['low', 'medium', 'high'] as const
export const EDGE_TYPES = ['eave', 'rake', 'ridge', 'hip', 'valley', 'transition', 'step_flashing', 'other'] as const
export const OBJECT_TYPES = ['skylight', 'chimney', 'hvac', 'pipe_boot', 'attic_vent', 'other'] as const
export type GeometryConfidence = typeof GEOMETRY_CONFIDENCES[number]
export type EdgeType = typeof EDGE_TYPES[number]
export type ObjectType = typeof OBJECT_TYPES[number]
export type Point = { x: number; y: number }
export type SuggestionStatus = 'suggested' | 'accepted' | 'rejected' | 'edited'
export type GeometrySuggestion = {
  contract_version: typeof GEOMETRY_CONTRACT_VERSION
  image_width: number
  image_height: number
  source_image_reference: string
  planes: Array<{ id: string; vertices: Point[]; suggested_pitch: string | null; confidence: GeometryConfidence; suggestion_status: SuggestionStatus }>
  edges: Array<{ id: string; start: Point; end: Point; classification: EdgeType; confidence: GeometryConfidence; suggestion_status: SuggestionStatus }>
  objects: Array<{ id: string; type: ObjectType; position: Point; confidence: GeometryConfidence; suggestion_status: SuggestionStatus }>
  warnings: string[]
}
export class GeometryContractValidationError extends Error {
  constructor(readonly path: string, message: string) { super(`Geometry contract violation at "${path}": ${message}`) }
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function finite(value: unknown, path: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new GeometryContractValidationError(path, 'must be a finite number'); return value }
function point(value: unknown, path: string, width: number, height: number): Point {
  if (!record(value)) throw new GeometryContractValidationError(path, 'must be an object')
  const x = finite(value.x, `${path}.x`); const y = finite(value.y, `${path}.y`)
  if (x < 0 || y < 0 || x > width || y > height) throw new GeometryContractValidationError(path, 'must be inside image bounds')
  return { x, y }
}
function orientation(a: Point, b: Point, c: Point) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) }
function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const ab1 = orientation(a, b, c); const ab2 = orientation(a, b, d); const cd1 = orientation(c, d, a); const cd2 = orientation(c, d, b)
  return ((ab1 > 0 && ab2 < 0) || (ab1 < 0 && ab2 > 0)) && ((cd1 > 0 && cd2 < 0) || (cd1 < 0 && cd2 > 0))
}
function validatePolygon(vertices: Point[], path: string) {
  if (vertices.length < 3 || vertices.length > 100) throw new GeometryContractValidationError(path, 'must contain 3–100 vertices')
  if (Math.abs(vertices.reduce((sum, p, i) => { const next = vertices[(i + 1) % vertices.length]; return sum + p.x * next.y - next.x * p.y }, 0)) < 0.5) throw new GeometryContractValidationError(path, 'must enclose a non-zero area')
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) {
    const iNext = (i + 1) % vertices.length; const jNext = (j + 1) % vertices.length
    if (i === j || iNext === j || jNext === i) continue
    if (segmentsCross(vertices[i], vertices[iNext], vertices[j], vertices[jNext])) throw new GeometryContractValidationError(path, 'self-intersecting polygons are rejected')
  }
}
function string(value: unknown, path: string, max = 200): string { if (typeof value !== 'string' || value.length > max) throw new GeometryContractValidationError(path, 'must be a bounded string'); return value }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T { if (typeof value !== 'string' || !allowed.includes(value as T)) throw new GeometryContractValidationError(path, `must be one of ${allowed.join(', ')}`); return value as T }
function suggestionStatus(value: unknown, path: string): SuggestionStatus { return value === undefined ? 'suggested' : enumValue(value, ['suggested', 'accepted', 'rejected', 'edited'], path) }
export function validateGeometrySuggestion(data: unknown): GeometrySuggestion {
  if (!record(data)) throw new GeometryContractValidationError('root', 'must be an object')
  if (data.contract_version !== GEOMETRY_CONTRACT_VERSION) throw new GeometryContractValidationError('contract_version', 'unsupported contract version')
  const width = finite(data.image_width, 'image_width'); const height = finite(data.image_height, 'image_height')
  if (width < 1 || width > 100000 || height < 1 || height > 100000) throw new GeometryContractValidationError('image', 'dimensions are outside supported limits')
  const source = string(data.source_image_reference, 'source_image_reference', 500)
  const planes = data.planes; const edges = data.edges; const objects = data.objects; const warnings = data.warnings
  if (!Array.isArray(planes) || !Array.isArray(edges) || !Array.isArray(objects) || !Array.isArray(warnings)) throw new GeometryContractValidationError('root', 'planes, edges, objects, and warnings must be arrays')
  const result = {
    contract_version: GEOMETRY_CONTRACT_VERSION, image_width: width, image_height: height, source_image_reference: source,
    planes: planes.map((item, i) => { if (!record(item)) throw new GeometryContractValidationError(`planes[${i}]`, 'must be an object'); const vertices = item.vertices; if (!Array.isArray(vertices)) throw new GeometryContractValidationError(`planes[${i}].vertices`, 'must be an array'); const points = vertices.map((v, j) => point(v, `planes[${i}].vertices[${j}]`, width, height)); validatePolygon(points, `planes[${i}].vertices`); return { id: string(item.id, `planes[${i}].id`, 80), vertices: points, suggested_pitch: item.suggested_pitch === null ? null : string(item.suggested_pitch, `planes[${i}].suggested_pitch`, 80), confidence: enumValue(item.confidence, GEOMETRY_CONFIDENCES, `planes[${i}].confidence`), suggestion_status: suggestionStatus(item.suggestion_status, `planes[${i}].suggestion_status`) } }),
    edges: edges.map((item, i) => { if (!record(item)) throw new GeometryContractValidationError(`edges[${i}]`, 'must be an object'); return { id: string(item.id, `edges[${i}].id`, 80), start: point(item.start, `edges[${i}].start`, width, height), end: point(item.end, `edges[${i}].end`, width, height), classification: enumValue(item.classification, EDGE_TYPES, `edges[${i}].classification`), confidence: enumValue(item.confidence, GEOMETRY_CONFIDENCES, `edges[${i}].confidence`), suggestion_status: suggestionStatus(item.suggestion_status, `edges[${i}].suggestion_status`) } }),
    objects: objects.map((item, i) => { if (!record(item)) throw new GeometryContractValidationError(`objects[${i}]`, 'must be an object'); return { id: string(item.id, `objects[${i}].id`, 80), type: enumValue(item.type, OBJECT_TYPES, `objects[${i}].type`), position: point(item.position, `objects[${i}].position`, width, height), confidence: enumValue(item.confidence, GEOMETRY_CONFIDENCES, `objects[${i}].confidence`), suggestion_status: suggestionStatus(item.suggestion_status, `objects[${i}].suggestion_status`) } }),
    warnings: warnings.map((warning, i) => string(warning, `warnings[${i}]`, 500)),
  }
  const ids = [...result.planes, ...result.edges, ...result.objects].map((item) => item.id)
  if (new Set(ids).size !== ids.length) throw new GeometryContractValidationError('root', 'suggestion IDs must be unique')
  return result
}
