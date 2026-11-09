export type PageField = {
  key: string
  label: string
  value?: string
  type?: string
}

export type PageFill = {
  key: string
  value: string
}

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
}

function clean(value: string) {
  return value.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim()
}

function quoted(instruction: string) {
  return [...instruction.matchAll(/["']([^"']{2,160})["']/g)].map((match) => clean(match[1]))
}

/**
 * Open-source only.
 * No OpenAI, Anthropic, Gemini, Xactimate, EagleView, Hover, AccuLynx, or JobNimbus calls.
 * Fill is deterministic. Local Ollama is the only optional model, and it is open-source.
 * Fill labeled page fields from a plain instruction.
 * Deterministic first so the agent works without a model.
 * Returns only fields the instruction actually named.
 */
export function fillPageFields(instruction: string, fields: PageField[]): PageFill[] {
  const text = instruction.trim()
  if (!text || !fields.length) return []

  const fills: PageFill[] = []
  const quotes = quoted(text)
  const lower = text.toLowerCase()

  for (const field of fields) {
    const label = field.label.trim()
    if (!label) continue
    const labelLower = label.toLowerCase()
    const escaped = labelLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const labeled = text.match(new RegExp(`${escaped}\\s*(?:is|to|=|:|as)\\s+([^\\n,;]{1,120})`, 'i'))
    if (labeled) {
      fills.push({ key: field.key, value: clean(labeled[1]) })
      continue
    }

    if (field.type === 'number' || /square|sq|pitch|count|amount|price|total/i.test(label)) {
      const number = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:for|on|in)?\\s*${escaped}`, 'i'))
      if (number) {
        fills.push({ key: field.key, value: number[1] })
        continue
      }
    }

    if (/address|property|location/i.test(label) && quotes.length) {
      const address = quotes.find((item) => /\d/.test(item) && /[a-z]/i.test(item))
      if (address) fills.push({ key: field.key, value: address })
      continue
    }

    if (/name|technician|inspector|owner/i.test(label)) {
      const named = text.match(/(?:name|technician|inspector|owner)\s+(?:is|to|=|:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/)
      if (named) fills.push({ key: field.key, value: named[1] })
    }
  }

  if (!fills.length && /fill|complete|set|enter|write/i.test(lower) && quotes.length) {
    const open = fields.find((field) => !field.value)
    if (open) fills.push({ key: open.key, value: quotes[0] })
  }

  const seen = new Set<string>()
  return fills.filter((fill) => {
    if (!fill.value || seen.has(fill.key)) return false
    seen.add(fill.key)
    return true
  })
}

export function describeFills(fills: PageFill[], fields: PageField[]) {
  if (!fills.length) return 'I did not find a field on this page to fill from that instruction.'
  const labels = fills.map((fill) => {
    const field = fields.find((item) => item.key === fill.key)
    return `${field?.label || fill.key} = ${fill.value}`
  })
  return `Filled ${fills.length} field${fills.length === 1 ? '' : 's'}: ${labels.join(', ')}.`
}
