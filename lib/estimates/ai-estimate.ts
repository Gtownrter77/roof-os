import { EstimateLineItemInput, computeEstimateTotals, EstimateCategory } from './estimate-types'
import { getOllamaVisionModel } from '../ai/local-vision.mjs'

export type RoofMeasurement = {
  roofSquares: number
  gutterLf: number
  ridgeLf: number
  hipLf: number
  valleyLf: number
  pitch: string
  stories: number
  roofStyle: string
  roofMaterial: string
  layers: number
  hasDripEdge: boolean
  hasIceWaterShield: boolean
}

export type AILineItemSuggestion = {
  item_code: string
  description: string
  category: 'material' | 'labor' | 'allowance' | 'fee' | 'tax'
  unit: string
  quantity: number
  unit_cost: number
  waste_factor: number
  confidence: number
  reasoning: string
}

export type AIPricingResult = {
  lineItems: AILineItemSuggestion[]
  totals: { material: number; labor: number; subtotal: number; tax: number; total: number }
  warnings: string[]
  roofMeasurement: RoofMeasurement
}

async function askOllama(prompt: string): Promise<string | null> {
  const host = process.env.OLLAMA_HOST?.trim() || 'http://127.0.0.1:11434'
  const model = process.env.OLLAMA_MODEL?.trim() || 'llama3:8b'
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, temperature: 0.1 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.trim() ?? null
  } catch {
    return null
  }
}

function parseJSONFromLLM(text: string): any | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {}
  return null
}

export async function generateEstimateFromMeasurements(
  measurements: RoofMeasurement,
  priceBookId?: string,
  templateId?: string,
  workspaceId?: string
): Promise<AIPricingResult> {
  const warnings: string[] = []

  // 1. Generate base line items from measurements using deterministic rules
  const baseItems = generateBaseLineItems(measurements)

  // 2. Try to enrich with AI if Ollama is available
  let enrichedItems = baseItems
  if (process.env.LLAMA_AGENT_ENABLED?.trim().toLowerCase() === 'true') {
    const aiEnriched = await enrichWithAI(baseItems, measurements)
    if (aiEnriched && aiEnriched.length) {
      enrichedItems = aiEnriched
    }
  }

  // 3. If price book is provided, apply pricing (placeholder for now)
  if (priceBookId) {
    warnings.push('Price book pricing not yet implemented - using default pricing')
  }

  // 4. Apply waste factors and calculate totals
  const lineItems = enrichedItems.map(item => ({
    ...item,
    line_total: item.quantity * item.unit_cost,
  }))

  const totals = computeEstimateTotals(lineItems.map(i => ({ quantity: i.quantity, unit_cost: i.unit_cost, category: i.category })))

  return {
    lineItems,
    totals: { material: 0, labor: 0, subtotal: totals.subtotal, tax: 0, total: totals.total },
    warnings,
    roofMeasurement: measurements,
  }
}

function generateBaseLineItems(measurements: RoofMeasurement): AILineItemSuggestion[] {
  const items: AILineItemSuggestion[] = []
  const sq = measurements.roofSquares

  // Material items
  items.push({
    item_code: 'SHINGLES-ARCH',
    description: 'Architectural shingles (30-year)',
    category: 'material',
    unit: 'SQ',
    quantity: Math.ceil(sq * 1.1),
    unit_cost: 95,
    waste_factor: 0.1,
    confidence: 0.95,
    reasoning: 'Primary roofing material with 10% waste for cuts and starter rows',
  })

  items.push({
    item_code: 'UNDERLAYMENT-SYN',
    description: 'Synthetic underlayment (10 sq/roll)',
    category: 'material',
    unit: 'ROLL',
    quantity: Math.ceil(sq / 10),
    unit_cost: 89,
    waste_factor: 0.05,
    confidence: 0.9,
    reasoning: 'Synthetic underlayment at 1 roll per 10 squares with 5% waste',
  })

  items.push({
    item_code: 'ICE-WATER-SHIELD',
    description: 'Ice & water shield (2 sq/roll)',
    category: 'material',
    unit: 'ROLL',
    quantity: Math.ceil(measurements.gutterLf / 66), // ~3 ft wide, 66 ft per roll at 2 ft up from eave
    unit_cost: 65,
    waste_factor: 0.1,
    confidence: 0.85,
    reasoning: 'Ice & water shield at eaves and valleys (2 rows)',
  })

  items.push({
    item_code: 'DRIP-EDGE',
    description: 'Drip edge metal (10 ft/piece)',
    category: 'material',
    unit: 'EA',
    quantity: Math.ceil((measurements.gutterLf + measurements.ridgeLf + measurements.hipLf) / 10),
    unit_cost: 3,
    waste_factor: 0.05,
    confidence: 0.9,
    reasoning: 'Drip edge at all eaves, rakes, and ridges',
  })

  items.push({
    item_code: 'STARTER-SHINGLES',
    description: 'Starter strip shingles (100 lf/bundle)',
    category: 'material',
    unit: 'BUNDLE',
    quantity: Math.ceil(measurements.gutterLf / 100),
    unit_cost: 48,
    waste_factor: 0.1,
    confidence: 0.9,
    reasoning: 'Starter course at all eaves and rakes',
  })

  items.push({
    item_code: 'HIP-RIDGE-CAP',
    description: 'Hip & ridge cap shingles (20 lf/bundle)',
    category: 'material',
    unit: 'BUNDLE',
    quantity: Math.ceil((measurements.ridgeLf + measurements.hipLf) / 20),
    unit_cost: 55,
    waste_factor: 0.1,
    confidence: 0.9,
    reasoning: 'Cap shingles for all hips and ridges',
  })

  items.push({
    item_code: 'VALLEY-METAL',
    description: 'W-valley metal (10 ft/piece)',
    category: 'material',
    unit: 'EA',
    quantity: Math.ceil(measurements.valleyLf / 10),
    unit_cost: 22,
    waste_factor: 0.15,
    confidence: 0.85,
    reasoning: 'Valley flashing for all roof valleys',
  })

  items.push({
    item_code: 'FLASHING-PIPE-BOOT',
    description: 'Pipe boot flashing',
    category: 'material',
    unit: 'EA',
    quantity: Math.max(1, Math.floor(sq / 10)), // ~1 per 10 sq
    unit_cost: 14,
    waste_factor: 0,
    confidence: 0.8,
    reasoning: 'Standard pipe boot flashing for roof penetrations',
  })

  items.push({
    item_code: 'RIDGE-VENT',
    description: 'Ridge vent (4 ft sections)',
    category: 'material',
    unit: 'EA',
    quantity: Math.ceil(measurements.ridgeLf / 4),
    unit_cost: 4,
    waste_factor: 0.1,
    confidence: 0.75,
    reasoning: 'Ridge ventilation at all ridges',
  })

  items.push({
    item_code: 'ROOFING-NAILS',
    description: 'Coil roofing nails (7200 nails/box)',
    category: 'material',
    unit: 'BOX',
    quantity: Math.ceil(sq / 2.5),
    unit_cost: 48,
    waste_factor: 0,
    confidence: 0.9,
    reasoning: 'Coil nails at ~4 nails per shingle, ~7200 per box',
  })

  items.push({
    item_code: 'ROOF-CEMENT',
    description: 'Roof cement (1 gal)',
    category: 'material',
    unit: 'GAL',
    quantity: Math.max(1, Math.ceil(sq / 15)),
    unit_cost: 16,
    waste_factor: 0,
    confidence: 0.7,
    reasoning: 'Sealant for flashings and vents',
  })

  items.push({
    item_code: 'CAULK',
    description: 'Polyurethane sealant (10 oz tube)',
    category: 'material',
    unit: 'TUBE',
    quantity: Math.max(2, Math.ceil(sq / 5)),
    unit_cost: 7.5,
    waste_factor: 0,
    confidence: 0.7,
    reasoning: 'Sealant for flashing details and pipe boots',
  })

  // Labor items
  items.push({
    item_code: 'TEAR-OFF',
    description: 'Tear off existing roofing (1 layer)',
    category: 'labor',
    unit: 'SQ',
    quantity: sq * measurements.layers,
    unit_cost: 55,
    waste_factor: 0,
    confidence: 0.95,
    reasoning: 'Tear-off labor per square per layer',
  })

  items.push({
    item_code: 'INSTALL-SHINGLES',
    description: 'Install new shingles',
    category: 'labor',
    unit: 'SQ',
    quantity: sq,
    unit_cost: 65,
    waste_factor: 0,
    confidence: 0.95,
    reasoning: 'Shingle installation labor per square',
  })

  items.push({
    item_code: 'FLASHING-LABOR',
    description: 'Flashing installation labor',
    category: 'labor',
    unit: 'HR',
    quantity: Math.ceil((measurements.gutterLf + measurements.ridgeLf + measurements.hipLf + measurements.valleyLf) / 40),
    unit_cost: 85,
    waste_factor: 0,
    confidence: 0.85,
    reasoning: 'Flashing installation labor at ~40 LF per hour',
  })

  items.push({
    item_code: 'CLEANUP',
    description: 'Job site cleanup and debris removal',
    category: 'labor',
    unit: 'HR',
    quantity: Math.max(2, Math.ceil(sq / 8)),
    unit_cost: 50,
    waste_factor: 0,
    confidence: 0.9,
    reasoning: 'Cleanup labor proportional to roof size',
  })

  // Dumpster/Disposal
  items.push({
    item_code: 'DUMPSTER',
    description: '30-yard dumpster rental (7-day)',
    category: 'fee',
    unit: 'EA',
    quantity: Math.ceil(sq / 25), // ~25 sq per 30-yard dumpster
    unit_cost: 450,
    waste_factor: 0,
    confidence: 0.9,
    reasoning: '30-yard dumpster per ~25 squares of tear-off',
  })

  // Permits
  items.push({
    item_code: 'PERMIT',
    description: 'Roofing permit fee',
    category: 'fee',
    unit: 'EA',
    quantity: 1,
    unit_cost: 250,
    waste_factor: 0,
    confidence: 0.9,
    reasoning: 'Standard municipal roofing permit',
  })

  return items
}

async function enrichWithAI(baseItems: AILineItemSuggestion[], measurements: RoofMeasurement): Promise<AILineItemSuggestion[]> {
  const prompt = `
You are a roofing estimator AI. Given the roof measurements and base line items, suggest improvements to quantities, waste factors, or additional items.

Roof measurements:
- Squares: ${measurements.roofSquares}
- Gutter LF: ${measurements.gutterLf}
- Ridge LF: ${measurements.ridgeLf}
- Hip LF: ${measurements.hipLf}
- Valley LF: ${measurements.valleyLf}
- Pitch: ${measurements.pitch}
- Stories: ${measurements.stories}
- Style: ${measurements.roofStyle}
- Material: ${measurements.roofMaterial}
- Layers: ${measurements.layers}
- Has drip edge: ${measurements.hasDripEdge}
- Has ice/water shield: ${measurements.hasIceWaterShield}

Base line items (JSON):
${JSON.stringify(baseItems.map(i => ({ item_code: i.item_code, description: i.description, category: i.category, unit: i.unit, quantity: i.quantity, unit_cost: i.unit_cost, waste_factor: i.waste_factor })), null, 2)}

Return ONLY a JSON array of suggested improvements with fields: item_code, suggested_quantity, suggested_waste_factor, reasoning. Only include items that need changes. Return empty array if no changes.
`

  try {
    const response = await askOllama(prompt)
    if (!response) return []

    const suggestions = parseJSONFromLLM(response)
    if (!Array.isArray(suggestions)) return []

    // Apply suggestions to base items
    const enriched = baseItems.map(base => {
      const suggestion = suggestions.find((s: any) => s.item_code === base.item_code)
      if (!suggestion) return base
      return {
        ...base,
        quantity: typeof suggestion.suggested_quantity === 'number' ? suggestion.suggested_quantity : base.quantity,
        waste_factor: typeof suggestion.suggested_waste_factor === 'number' ? suggestion.suggested_waste_factor : base.waste_factor,
        reasoning: suggestion.reasoning || base.reasoning,
        confidence: Math.min(base.confidence + 0.05, 1),
      }
    })
    return enriched
  } catch {
    return []
  }
}

export async function suggestTemplateFromRoofType(roofStyle: string, roofMaterial: string): Promise<string | null> {
  if (process.env.LLAMA_AGENT_ENABLED?.trim().toLowerCase() !== 'true') return null

  const prompt = `Given a roof style of "${roofStyle}" and material "${roofMaterial}", suggest the most appropriate estimate template name from a standard roofing catalog. Return only the template name as a string, or "null" if no specific template applies.`

  try {
    const response = await askOllama(prompt)
    return response?.trim() || null
  } catch {
    return null
  }
}

export function calculateWasteFactor(roofStyle: string, pitch: string, complexity: number): number {
  let baseWaste = 0.1 // 10% base

  // Style adjustments
  switch (roofStyle.toLowerCase()) {
    case 'complex_combination':
    case 'cut_up':
      baseWaste += 0.05
      break
    case 'hip':
    case 'mansard':
      baseWaste += 0.03
      break
    case 'gambrel':
      baseWaste += 0.02
      break
  }

  // Pitch adjustments
  const pitchNum = parseFloat(pitch.split(':')[0] || '4')
  if (pitchNum >= 8) baseWaste += 0.05
  else if (pitchNum >= 6) baseWaste += 0.02

  // Complexity (1-5)
  baseWaste += complexity * 0.01

  return Math.min(baseWaste, 0.25) // Cap at 25%
}