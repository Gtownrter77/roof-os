import { hashText } from './util.ts'
import { wasteTable } from './measurements.ts'
import type {
  Deliverable, FacetGraph, InputManifest, MeasurementRecord, MeasurementSet, ReportPackage,
} from './types.ts'

export type ReportPayload = {
  rulesetVersion: string
  deliverable: Deliverable
  manifestHash: string
  modelUrl: string | null
  set: MeasurementSet
  sections: string[]
  photoGallery: { imageId: string; slot: string | null; storagePath: string }[]
  glossary: { type: string; label: string; unit: string; definition: string }[]
  wasteFactors: Record<string, number>
  facets: { id: string; material: string | null; role: string; area: string; pitch: string }[]
}

const GLOSSARY: Record<string, { label: string; definition: string }> = {
  facet_area: { label: 'Facet area', definition: 'Surface area of one roof plane traced from the model.' },
  facet_pitch: { label: 'Facet pitch', definition: 'Roof slope of one plane in degrees.' },
  pitch_adjusted_squares: { label: 'Pitch-adjusted squares', definition: 'Roof area including pitch and material waste, in 100 sq ft squares.' },
  ridge_lf: { label: 'Ridge', definition: 'Highest intersection of two roof planes, in linear feet.' },
  hip_lf: { label: 'Hip', definition: 'External intersection sloping to an eave, in linear feet.' },
  valley_lf: { label: 'Valley', definition: 'Internal intersection collecting water, in linear feet.' },
  eave_lf: { label: 'Eave', definition: 'Lower roof edge, in linear feet.' },
  rake_lf: { label: 'Rake', definition: 'Sloped roof edge at a gable, in linear feet.' },
  gutter_lf: { label: 'Gutter', definition: 'Measured gutter run, in linear feet.' },
  downspout_count: { label: 'Downspouts', definition: 'Count of downspouts observed on the exterior.' },
  soffit_area: { label: 'Soffit area', definition: 'Underside area of the roof overhang.' },
  siding_area: { label: 'Siding area', definition: 'Measured vertical wall area.' },
  opening: { label: 'Opening', definition: 'Door, window or sliding-glass opening; Unknown when unmeasured.' },
  unknown: { label: 'Unknown', definition: 'Not measured. Carried forward as Unknown, never zero.' },
}

const FULL_EXTERIOR_SECTIONS = [
  'siding_summary', 'elevations', 'facade_details', 'openings', 'gutters', 'downspout_count',
]

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

function displayValue(record: MeasurementRecord): string {
  return record.value === null ? 'Unknown' : String(record.value)
}

function buildPayload(input: {
  set: MeasurementSet
  manifest: InputManifest
  graph?: FacetGraph
  deliverable?: Deliverable
  modelUrl?: string | null
}): ReportPayload {
  const deliverable = input.deliverable ?? 'roof_only'
  const sections = [
    'model_link', 'photo_gallery', 'measurement_glossary', 'roof_summary',
    'facet_table', 'pitch_adjusted_squares', 'waste_factor_table',
    ...(deliverable === 'roof_only' ? ['soffit'] : []),
    ...(deliverable === 'full_exterior' ? FULL_EXTERIOR_SECTIONS : []),
  ]
  const byFacet = new Map<string, { area: string; pitch: string }>()
  for (const record of input.set.records) {
    if (!record.facetId) continue
    const current = byFacet.get(record.facetId) ?? { area: 'Unknown', pitch: 'Unknown' }
    if (record.type === 'facet_area') current.area = displayValue(record)
    if (record.type === 'facet_pitch') current.pitch = displayValue(record)
    byFacet.set(record.facetId, current)
  }
  return {
    rulesetVersion: input.set.rulesetVersion,
    deliverable,
    manifestHash: input.manifest.manifestHash,
    modelUrl: input.modelUrl ?? null,
    set: input.set,
    sections,
    photoGallery: (input.manifest.images ?? []).map((image) => ({
      imageId: image.id, slot: image.slot ?? null, storagePath: image.storagePath,
    })),
    glossary: Object.entries(GLOSSARY).map(([type, entry]) => ({
      type, label: entry.label, definition: entry.definition, unit: '',
    })),
    wasteFactors: wasteTable(),
    facets: (input.graph?.facets ?? []).map((facet) => ({
      id: facet.id,
      material: facet.material,
      role: facet.role,
      area: byFacet.get(facet.id)?.area ?? 'Unknown',
      pitch: byFacet.get(facet.id)?.pitch ?? 'Unknown',
    })),
  }
}

function renderLines(payload: ReportPayload): string[] {
  const lines: string[] = [
    'HOVER MEASURED EXTERIOR REPORT',
    `Ruleset: ${payload.rulesetVersion}`,
    `Deliverable: ${payload.deliverable}`,
    `Manifest: ${payload.manifestHash}`,
    `3D model: ${payload.modelUrl ?? 'Unknown'}`,
    'PHOTO GALLERY',
  ]
  for (const photo of payload.photoGallery) {
    lines.push(`  ${photo.imageId}  ${photo.slot ?? 'Unknown'}  ${photo.storagePath}`)
  }
  lines.push('MEASUREMENT GLOSSARY')
  for (const item of payload.glossary) lines.push(`  ${item.type}: ${item.definition}`)
  lines.push('ROOF SUMMARY / FACET TABLE')
  for (const record of payload.set.records) {
    lines.push(`  ${record.type}  ${record.facetId ?? '-'}  ${displayValue(record)}  ${record.unit}`)
  }
  for (const facet of payload.facets) {
    lines.push(`  facet ${facet.id}  ${facet.material ?? 'Unknown'}  ${facet.area}  ${facet.pitch}`)
  }
  lines.push('PITCH-ADJUSTED SQUARES / WASTE FACTORS')
  for (const [material, factor] of Object.entries(payload.wasteFactors)) {
    lines.push(`  ${material} waste ${factor}`)
  }
  if (payload.sections.includes('soffit')) lines.push('SOFFIT: reported from measured soffit_area records above')
  for (const section of FULL_EXTERIOR_SECTIONS) {
    if (payload.sections.includes(section)) lines.push(`${section.toUpperCase()}: reported from measured records above`)
  }
  return lines
}

function buildPdf(lines: string[]): string {
  const safe = (text: string) => text
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
  const stream = `BT /F1 9 Tf 40 752 Td 11 TL\n${
    lines.map((line, index) => `${index === 0 ? '' : 'T* '}(${safe(line)}) Tj`).join('\n')
  }\nET\n`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 0; i < objects.length; i++) {
    pdf += `${String(offsets[i + 1]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return pdf
}

function buildXls(payload: ReportPayload): string {
  const rows = ['HOVER REPORT\truleset\t' + payload.rulesetVersion,
    `deliverable\t${payload.deliverable}`,
    `manifest_hash\t${payload.manifestHash}`,
    `model_url\t${payload.modelUrl ?? 'Unknown'}`,
    'SECTION\tKEY\tLABEL\tVALUE\tUNIT\tEVIDENCE']
  for (const record of payload.set.records) {
    rows.push([
      record.type === 'soffit_area' ? 'soffit' : 'measurements',
      record.id, record.type, displayValue(record), record.unit,
      record.sourceRefs.map((ref) => ref.imageId ?? ref.modelVersion ?? '').join('|'),
    ].join('\t'))
  }
  for (const [material, factor] of Object.entries(payload.wasteFactors)) {
    rows.push(['waste_factor_table', material, 'waste', String(factor), 'ratio', ''].join('\t'))
  }
  for (const section of payload.sections) {
    rows.push(['sections', section, section, 'present', '', ''].join('\t'))
  }
  return rows.join('\n') + '\n'
}

function buildXml(payload: ReportPayload): string {
  const escaped = stableStringify(payload)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<hover-report rulesetVersion="${payload.rulesetVersion}" deliverable="${payload.deliverable}">`,
    `  <manifestHash>${payload.manifestHash}</manifestHash>`,
    `  <sections>${payload.sections.join(',')}</sections>`,
    `  <rendered>${renderLines(payload).map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join(' | ')}</rendered>`,
    `  <payload><![CDATA[${stableStringify(payload)}]]></payload>`,
    `  <escapedChecksum>${hashText(escaped)}</escapedChecksum>`,
    '</hover-report>',
  ].join('\n') + '\n'
}

export function buildReportPackage(input: {
  set: MeasurementSet
  manifest: InputManifest
  graph?: FacetGraph
  deliverable?: Deliverable
  modelUrl?: string | null
}): ReportPackage[] {
  const payload = buildPayload(input)
  const lines = renderLines(payload)
  const entries: { format: ReportPackage['format']; content: string }[] = [
    { format: 'PDF', content: buildPdf(lines) },
    { format: 'XLS', content: buildXls(payload) },
    { format: 'XML', content: buildXml(payload) },
    { format: 'JSON', content: stableStringify(payload) + '\n' },
  ]
  return entries.map((entry) => ({
    format: entry.format,
    content: entry.content,
    contentHash: hashText(entry.content),
    rulesetVersion: payload.rulesetVersion,
    sections: payload.sections,
  }))
}

export function parseReportPayload(content: string, format: ReportPackage['format']): ReportPayload {
  if (format === 'JSON') return JSON.parse(content) as ReportPayload
  if (format === 'XML') {
    const match = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
    if (!match) throw new Error('hover XML report has no payload')
    return JSON.parse(match[1]) as ReportPayload
  }
  throw new Error(`parseReportPayload is not supported for ${format}`)
}
