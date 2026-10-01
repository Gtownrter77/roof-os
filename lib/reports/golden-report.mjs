export const GOLDEN_REPORT_SECTION_IDS = [
  'cover', 'looked-at', 'saw', 'did-not-see', 'storms', 'measurements',
  'verification', 'codes', 'supplements', 'not', 'questions', 'signatures',
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function getGoldenReportContractErrors(report) {
  const errors = []
  if (!isRecord(report)) return ['Report must be an object.']
  if (report.version !== 'golden-report-v1.0') errors.push('Report version must be golden-report-v1.0.')
  if (report.status !== 'draft') errors.push('Report must stay a draft until signatures and approval exist.')
  if (typeof report.reportId !== 'string' || !report.reportId.trim()) errors.push('Report ID is required.')
  if (typeof report.generatedAt !== 'string' || !Number.isFinite(Date.parse(report.generatedAt))) errors.push('A valid report generation date is required.')

  const sections = report.sections
  if (!Array.isArray(sections) || sections.length !== GOLDEN_REPORT_SECTION_IDS.length) {
    errors.push('Report must contain all 12 Golden Report sections.')
  } else {
    const ids = sections.map((section) => isRecord(section) ? section.id : null)
    if (GOLDEN_REPORT_SECTION_IDS.some((id, index) => ids[index] !== id)) errors.push('Golden Report sections must appear in the standard order.')
    for (const section of sections) {
      if (!isRecord(section)) { errors.push('Every report section must be an object.'); continue }
      if (typeof section.title !== 'string' || !section.title.trim()) errors.push(`Section ${section.id ?? 'unknown'} needs a title.`)
      if (section.statements !== undefined && (!Array.isArray(section.statements) || section.statements.some((text) => typeof text !== 'string' || !text.trim()))) {
        errors.push(`Section ${section.id ?? 'unknown'} contains an empty or invalid statement.`)
      }
      if (section.items !== undefined && (!Array.isArray(section.items) || section.items.some((item) => !isRecord(item) || !['label', 'value', 'source'].every((key) => typeof item[key] === 'string' && item[key].trim())))) {
        errors.push(`Section ${section.id ?? 'unknown'} has a value without a labeled source.`)
      }
      if (section.photos !== undefined && (!Array.isArray(section.photos) || section.photos.some((photo) => !isRecord(photo) || !['id', 'altText', 'caption', 'capturedAt', 'mimeType', 'usability'].every((key) => typeof photo[key] === 'string' && photo[key].trim())))) {
        errors.push('Every source photo needs an ID, plain alt text, caption, date, file type, and usability status.')
      }
    }
  }

  const photoSection = Array.isArray(sections) ? sections.find((section) => isRecord(section) && section.id === 'looked-at') : null
  if (!isRecord(report.sourceEvidence) || !Array.isArray(report.sourceEvidence.photoIds) || !isRecord(photoSection) || !Array.isArray(photoSection.photos) || report.sourceEvidence.photoIds.length !== photoSection.photos.length || report.sourceEvidence.photoCount !== photoSection.photos.length) {
    errors.push('Photo evidence IDs, count, and displayed photo list must agree.')
  } else if (report.sourceEvidence.photoIds.some((id, index) => id !== photoSection.photos[index].id)) {
    errors.push('Displayed source photo IDs must match the persisted evidence order.')
  }

  if (!isRecord(report.footer) || !['motto', 'text', 'company', 'phone'].every((key) => typeof report.footer[key] === 'string' && report.footer[key].trim())) {
    errors.push('The Golden Report footer must be complete, using Unknown for missing details.')
  }
  const serialized = JSON.stringify(report)
  if (/\$\s?\d/.test(serialized)) errors.push('Dollar amounts are not permitted in the Golden Report.')
  if (/"(?:ai_analysis|aiObservations)"\s*:/i.test(serialized)) errors.push('Unconfirmed AI output is not permitted in the Golden Report.')
  return errors
}
