export function normalizeNoaaPlace(value) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,']/g, ' ')
    .replace(/\b(?:COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPALITY|CITY AND BOROUGH)\b\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse RFC-4180-style CSV records, including escaped quotes and quoted newlines. */
export function forEachCsvRecord(text, onRecord) {
  let fields = []
  let field = ''
  let inQuotes = false
  let rowStarted = false

  const finishField = () => {
    fields.push(field)
    field = ''
  }
  const finishRecord = () => {
    finishField()
    if (rowStarted || fields.some((value) => value !== '')) onRecord(fields)
    fields = []
    rowStarted = false
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      rowStarted = true
      continue
    }

    if (char === '"') {
      if (field.length !== 0) throw new Error('Malformed NOAA CSV quoting.')
      inQuotes = true
      rowStarted = true
    } else if (char === ',') {
      finishField()
      rowStarted = true
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      finishRecord()
    } else {
      field += char
      rowStarted = true
    }
  }

  if (inQuotes) throw new Error('Unclosed NOAA CSV quoted field.')
  if (rowStarted || fields.length > 0 || field.length > 0) finishRecord()
}
