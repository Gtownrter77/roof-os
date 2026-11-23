import { buildReportPackage } from './report.ts'
import { hashText } from './util.ts'
import type { ExportResult, FacetGraph, InputManifest, MeasurementSet } from './types.ts'

export const EXPORT_FORMATS = ['PDF', 'XLS', 'XML', 'JSON', 'ESX', 'SKP', 'DWG', 'DXF'] as const
export const gatedFormats = ['ESX', 'SKP', 'DWG'] as const

export type ExportInput = {
  format: ExportResult['format']
  set: MeasurementSet
  graph: FacetGraph
  manifest: InputManifest
  deliverable?: 'roof_only' | 'full_exterior' | 'photos_only'
  modelUrl?: string | null
  /** Owner-issued approval token. Required before any licensed format can be attempted. */
  ownerApproval?: string
  /** Injected licensed converter; absent means the format is explicitly unsupported. */
  converter?: (args: { format: ExportResult['format']; set: MeasurementSet }) => string
}

function unsupported(format: ExportResult['format'], rulesetVersion: string, reason: string): ExportResult {
  return {
    format, content: `${format}\nUNSUPPORTED\n${reason}\n`, contentHash: hashText(reason),
    rulesetVersion, status: 'unsupported', reason,
  }
}

function finish(format: ExportResult['format'], content: string, rulesetVersion: string): ExportResult {
  return { format, content, contentHash: hashText(content), rulesetVersion, status: 'ok' }
}

function blocked(format: ExportResult['format'], rulesetVersion: string, reason: string): ExportResult {
  // A canonical hash still covers the deterministic refusal record.
  return {
    format, content: `${format}\nBLOCKED\n${reason}\n`, contentHash: hashText(reason),
    rulesetVersion, status: 'blocked', reason,
  }
}

/** ASCII DXF R12 subset: only measured edge geometry, no stylized or invented entities. */
function buildDxf(graph: FacetGraph): string {
  const lines = [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
  ]
  for (const edge of graph.edges) {
    lines.push(
      '0', 'LINE', '8', `HOVER_${edge.type.toUpperCase()}`,
      '10', edge.start.x.toFixed(1), '20', edge.start.y.toFixed(1), '30', edge.start.z.toFixed(1),
      '11', edge.end.x.toFixed(1), '21', edge.end.y.toFixed(1), '31', edge.end.z.toFixed(1),
    )
  }
  lines.push('0', 'ENDSEC', '0', 'EOF')
  return `${lines.join('\n')}\n`
}

export function generateExport(input: ExportInput): ExportResult {
  const rulesetVersion = input.set.rulesetVersion
  if (!EXPORT_FORMATS.includes(input.format)) {
    throw new Error(`unsupported export format: ${input.format}`)
  }

  if (gatedFormats.includes(input.format as never)) {
    if (!input.ownerApproval || input.ownerApproval.trim() === '') {
      return blocked(input.format, rulesetVersion, `owner approval token required for ${input.format}`)
    }
    if (!input.converter) {
      return unsupported(
        input.format, rulesetVersion,
        `no licensed converter configured for ${input.format}; refusing to fabricate a binary`,
      )
    }
    const content = input.converter({ format: input.format, set: input.set })
    return finish(input.format, content, rulesetVersion)
  }

  if (input.format === 'DXF') {
    return finish('DXF', buildDxf(input.graph), rulesetVersion)
  }

  const pkg = buildReportPackage({
    set: input.set,
    manifest: input.manifest,
    graph: input.graph,
    deliverable: input.deliverable,
    modelUrl: input.modelUrl,
  })
  const artifact = pkg.find((item) => item.format === input.format)
  if (!artifact) throw new Error(`report package missing ${input.format}`)
  return finish(input.format, artifact.content, rulesetVersion)
}
