/**
 * ROOF/OS AI Visual Observation Contract v1.0.0
 *
 * CORE ARCHITECTURAL INVARIANT:
 * AI observes. ROOF/OS validates. Geometry calculates. Technician verifies. Estimator prices.
 *
 * This structure represents non-authoritative visual detections extracted from photos.
 * It contains ZERO certified dimensions, ZERO calculated square footages, and ZERO pricing/coverage determinations.
 */

export const ROOF_AI_CONTRACT_VERSION = '1.0.0' as const

export const ROOF_AI_DISCLAIMER =
  'NON-AUTHORITATIVE VISUAL OBSERVATIONS ONLY. Not certified measurements, engineering determinations, insurance damage verifications, or pricing calculations. All observations require independent physical verification by a licensed roofing technician.' as const

export type MeasurementStatus =
  | 'observed'
  | 'estimated'
  | 'derived'
  | 'verified'
  | 'unavailable'

export type RoofStyle =
  | 'gable'
  | 'hip'
  | 'gambrel'
  | 'mansard'
  | 'shed'
  | 'flat'
  | 'complex_combination'
  | 'none_visible'
  | 'indeterminate'

export type RoofMaterial =
  | 'architectural_shingle'
  | '3_tab_shingle'
  | 'metal_standing_seam'
  | 'metal_corrugated'
  | 'clay_tile'
  | 'concrete_tile'
  | 'slate'
  | 'wood_shake'
  | 'modified_bitumen'
  | 'tpo_pvc_membrane'
  | 'built_up_roof'
  | 'other'
  | 'indeterminate'

export type PitchClass =
  | 'flat'
  | 'low_slope'
  | 'standard'
  | 'steep'
  | 'extreme'
  | 'indeterminate'

export type Orientation =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northeast'
  | 'northwest'
  | 'southeast'
  | 'southwest'
  | 'indeterminate'

export type EdgeType =
  | 'eave'
  | 'rake'
  | 'ridge'
  | 'hip'
  | 'valley'
  | 'wall_flashing'
  | 'step_flashing'
  | 'transition'

export type PenetrationType =
  | 'plumbing_vent_pipe'
  | 'hvac_flue'
  | 'box_vent'
  | 'ridge_vent'
  | 'power_attic_vent'
  | 'chimney'
  | 'skylight'
  | 'satellite_dish'
  | 'solar_panel'
  | 'other'

export type DamageCategory =
  | 'missing_shingles'
  | 'creased_shingles'
  | 'hail_impact_marks'
  | 'granule_loss'
  | 'wind_lift'
  | 'tree_strike'
  | 'debris'
  | 'corrosion'
  | 'flashing_failure'
  | 'moss_algae'
  | 'wear_aging'
  | 'indeterminate'

export type DamageSeverity =
  | 'superficial'
  | 'moderate'
  | 'severe'
  | 'indeterminate'

export type VisualConfidence = 'low' | 'medium' | 'high'

export interface ImageAuditItem {
  photo_index: number
  roof_visibility: 'full' | 'partial' | 'minimal' | 'none'
  quality: 'clear' | 'blurry' | 'glare' | 'underexposed' | 'overexposed' | 'low_resolution'
  perspective: 'ground_level' | 'ladder_level' | 'roof_level' | 'aerial' | 'excessive_angle'
  obstructions: Array<'trees_foliage' | 'power_lines' | 'shadows' | 'snow_ice' | 'equipment' | 'none'>
  is_duplicate_or_near_duplicate: boolean
  usable_for_analysis: boolean
  audit_notes: string
}

export interface FacetObservation {
  facet_id: string
  label: string
  facet_type: 'main_pitch' | 'dormer' | 'porch' | 'shed' | 'addition' | 'other'
  orientation: Orientation
  pitch_class: PitchClass
  apparent_pitch: string
  confidence: VisualConfidence
  measurement_status: 'estimated' | 'observed' | 'unavailable'
  source_photo_indices: number[]
  notes: string
}

export interface EdgeObservation {
  edge_id: string
  edge_type: EdgeType
  adjacent_facet_ids: string[]
  visible_condition: 'intact' | 'damaged' | 'aged' | 'occluded' | 'indeterminate'
  confidence: VisualConfidence
  source_photo_indices: number[]
  notes: string
}

export interface PenetrationObservation {
  penetration_id: string
  penetration_type: PenetrationType
  associated_facet_id: string | null
  visible_condition: 'good' | 'flashing_damaged' | 'cracked_boot' | 'deteriorated' | 'indeterminate'
  confidence: VisualConfidence
  source_photo_indices: number[]
  notes: string
}

export interface DamageObservation {
  damage_id: string
  observation_type: 'observed' | 'inferred'
  category: DamageCategory
  severity: DamageSeverity
  location_description: string
  associated_facet_id: string | null
  confidence: VisualConfidence
  source_photo_indices: number[]
  notes: string
}

export interface RoofClassification {
  roof_style: RoofStyle
  primary_material: RoofMaterial
  secondary_material: RoofMaterial | null
  apparent_condition: 'good' | 'fair' | 'poor' | 'severe_distress' | 'indeterminate'
  complexity_class: 'simple' | 'moderate' | 'complex' | 'cut_up'
  confidence: VisualConfidence
}

export interface RoofAIObservationPacket {
  contract_version: typeof ROOF_AI_CONTRACT_VERSION
  analyzed_at: string
  model_id: string
  measurement_status: 'unverified_ai_observation'
  authority_disclaimer: typeof ROOF_AI_DISCLAIMER
  image_audit: ImageAuditItem[]
  roof_classification: RoofClassification
  facet_observations: FacetObservation[]
  edge_observations: EdgeObservation[]
  penetration_observations: PenetrationObservation[]
  damage_observations: DamageObservation[]
  summary: string
  warnings: string[]
}

// -------------------------------------------------------------
// STRICT RUNTIME VALIDATION
// -------------------------------------------------------------

export class AIContractValidationError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(`AI Contract Violation at "${path}": ${message}`)
    this.name = 'AIContractValidationError'
    this.path = path
  }
}

export const FORBIDDEN_METRIC_KEYS = new Set([
  'roof_squares',
  'squares',
  'roof_area_sqft',
  'facet_area',
  'area_sqft',
  'area',
  'length_ft',
  'linear_feet',
  'quantity',
  'price',
  'cost',
  'estimate_amount',
  'total_price',
  'insurance_coverage',
  'claim_decision',
  'code_compliance',
  'certified_measurement',
  'certified_pitch',
  'payout',
  'deductible',
  'acv',
  'rcv',
  'depreciation'
])

export const AUTHORITATIVE_PITCH_TERMS = /certified|verified|official|guaranteed|engineered|exact\s+pitch|authoritative/i
export const AUTHORITATIVE_CLAIM_TERMS = /coverage\s+approved|claim\s+payable|code\s+violation|certified\s+repair\s+cost/i

const NARRATIVE_TEXT_KEYS = new Set([
  'apparent_pitch',
  'summary',
  'warnings',
  'audit_notes',
  'label',
  'notes',
  'location_description',
])
const NUMERIC_PITCH_RATIO_TEXT = /\b\d+(?:\.\d+)?\s*(?:\/|:)\s*\d+(?:\.\d+)?\b/i
const NUMERIC_MEASUREMENT_TEXT = /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+feet|linear\s+feet|linear\s+ft|feet|foot|ft|inches?|millimeters?|mm|centimeters?|cm|meters?|metres?)\b|\b(?:roof\s+)?area\s*(?:(?:is|about|approximately)\s*)?(?:is\s*)?\d+(?:,\d{3})*(?:\.\d+)?\b/i
const COUNT_NUMBER_TEXT = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|several|multiple)'
const COUNTED_ROOF_ITEMS = new RegExp(`\\b${COUNT_NUMBER_TEXT}\\s+(?:roof\\s+)?(?:squares?|shingles?|tiles?|panels?|vents?|penetrations?|facets?)\\b`, 'i')
const AUTHORITATIVE_NARRATIVE_TERMS = /\b(?:certified|verified|official|guaranteed|engineered|engineering|authoritative)\b|\bexact\s+(?:pitch|measurement|area|quantity|price|cost)\b/i
const CLAIM_DECISION_NARRATIVE_TERMS = /\b(?:coverage\s+(?:approved|denied)|claim\s+(?:payable|approved|denied)|code[-\s](?:violation|compliant|compliance|determination)|insurance\s+(?:coverage|decision|approval)|pricing|price\s+quote|estimated\s+cost|payout|deductible|acv|rcv|depreciation)\b|\b(?:insurance|insurer)\s+(?:will|would|should|may|might|must)\s+(?:cover|approve|deny|pay|fund)\b|\b(?:meets?|complies?\s+with|satisfies?)\s+(?:(?:local|building)\s+){0,2}code\b|\$\s*\d|\bUSD\b/i

const ALLOWED_ROOT_KEYS = new Set([
  'contract_version',
  'analyzed_at',
  'model_id',
  'measurement_status',
  'authority_disclaimer',
  'image_audit',
  'roof_classification',
  'facet_observations',
  'edge_observations',
  'penetration_observations',
  'damage_observations',
  'summary',
  'warnings'
])

const ALLOWED_IMAGE_AUDIT_KEYS = new Set([
  'photo_index',
  'roof_visibility',
  'quality',
  'perspective',
  'obstructions',
  'is_duplicate_or_near_duplicate',
  'usable_for_analysis',
  'audit_notes'
])

const ALLOWED_ROOF_CLASSIFICATION_KEYS = new Set([
  'roof_style',
  'primary_material',
  'secondary_material',
  'apparent_condition',
  'complexity_class',
  'confidence'
])

const ALLOWED_FACET_KEYS = new Set([
  'facet_id',
  'label',
  'facet_type',
  'orientation',
  'pitch_class',
  'apparent_pitch',
  'confidence',
  'measurement_status',
  'source_photo_indices',
  'notes'
])

const ALLOWED_EDGE_KEYS = new Set([
  'edge_id',
  'edge_type',
  'adjacent_facet_ids',
  'visible_condition',
  'confidence',
  'source_photo_indices',
  'notes'
])

const ALLOWED_PENETRATION_KEYS = new Set([
  'penetration_id',
  'penetration_type',
  'associated_facet_id',
  'visible_condition',
  'confidence',
  'source_photo_indices',
  'notes'
])

const ALLOWED_DAMAGE_KEYS = new Set([
  'damage_id',
  'observation_type',
  'category',
  'severity',
  'location_description',
  'associated_facet_id',
  'confidence',
  'source_photo_indices',
  'notes'
])

function assertNoForbiddenKeys(obj: unknown, path = 'root'): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoForbiddenKeys(obj[i], `${path}[${i}]`)
    }
    return
  }
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = `${path}.${key}`
    if (FORBIDDEN_METRIC_KEYS.has(key.toLowerCase())) {
      throw new AIContractValidationError(currentPath, `Forbidden metric/commercial key "${key}" detected`)
    }
    assertNoForbiddenKeys(value, currentPath)
  }
}

function assertSafeNarrativeText(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeNarrativeText(item, `${path}[${index}]`))
    return
  }
  if (typeof value !== 'string') return
  if (NUMERIC_PITCH_RATIO_TEXT.test(value)) {
    throw new AIContractValidationError(path, 'Numeric pitch ratios are prohibited in AI narrative text')
  }
  if (NUMERIC_MEASUREMENT_TEXT.test(value)) {
    throw new AIContractValidationError(path, 'Numeric measurements are prohibited in AI narrative text')
  }
  if (COUNTED_ROOF_ITEMS.test(value)) {
    throw new AIContractValidationError(path, 'Quantities are prohibited in AI narrative text')
  }
  if (AUTHORITATIVE_NARRATIVE_TERMS.test(value)) {
    throw new AIContractValidationError(path, 'Authority language is prohibited in AI narrative text')
  }
  if (CLAIM_DECISION_NARRATIVE_TERMS.test(value)) {
    throw new AIContractValidationError(path, 'Claims and code decisions are prohibited in AI narrative text')
  }
}

function assertNoUnsafeNarrativeText(value: unknown, path = 'root'): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafeNarrativeText(item, `${path}[${index}]`))
    return
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'authority_disclaimer') continue
    const childPath = `${path}.${key}`
    if (NARRATIVE_TEXT_KEYS.has(key)) {
      assertSafeNarrativeText(item, childPath)
    } else if (item && typeof item === 'object') {
      assertNoUnsafeNarrativeText(item, childPath)
    }
  }
}

function assertExactKeys(obj: Record<string, unknown>, allowedKeys: Set<string>, path: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw new AIContractValidationError(`${path}.${key}`, `Unknown property "${key}" is prohibited`)
    }
  }
}

function assertString(val: unknown, path: string, maxLen = 4000): asserts val is string {
  if (typeof val !== 'string' || !val.trim()) {
    throw new AIContractValidationError(path, 'Must be a non-empty string')
  }
  if (val.length > maxLen) {
    throw new AIContractValidationError(path, `String exceeds max length of ${maxLen}`)
  }
}

function assertEnum<T extends string>(val: unknown, allowed: readonly T[], path: string): asserts val is T {
  if (typeof val !== 'string' || !allowed.includes(val as T)) {
    throw new AIContractValidationError(path, `Expected one of [${allowed.join(', ')}], got "${String(val)}"`)
  }
}

function assertArray(val: unknown, path: string): asserts val is unknown[] {
  if (!Array.isArray(val)) {
    throw new AIContractValidationError(path, 'Must be an array')
  }
}

function assertPhotoIndex(val: unknown, path: string, maxPhotos?: number): asserts val is number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    throw new AIContractValidationError(path, 'Photo index must be a non-negative integer')
  }
  if (typeof maxPhotos === 'number' && maxPhotos > 0 && val >= maxPhotos) {
    throw new AIContractValidationError(path, `Photo index ${val} out of bounds for ${maxPhotos} submitted photos`)
  }
}

export function validateRoofAIObservationPacket(data: unknown, photoCount?: number): RoofAIObservationPacket {
  if (!data || typeof data !== 'object') {
    throw new AIContractValidationError('root', 'Observation packet must be a non-null object')
  }

  // Deep recursive forbidden-key validation
  assertNoForbiddenKeys(data, 'root')

  const root = data as Record<string, unknown>
  assertExactKeys(root, ALLOWED_ROOT_KEYS, 'root')

  // Top-level immutable contract constants
  if (root.contract_version !== ROOF_AI_CONTRACT_VERSION) {
    throw new AIContractValidationError('contract_version', `Expected "${ROOF_AI_CONTRACT_VERSION}", got "${String(root.contract_version)}"`)
  }
  if (root.measurement_status !== 'unverified_ai_observation') {
    throw new AIContractValidationError('measurement_status', 'Must be strictly "unverified_ai_observation"')
  }
  if (root.authority_disclaimer !== ROOF_AI_DISCLAIMER) {
    throw new AIContractValidationError('authority_disclaimer', 'Authority disclaimer string mismatch')
  }

  assertString(root.analyzed_at, 'analyzed_at', 64)
  if (Number.isNaN(Date.parse(root.analyzed_at))) {
    throw new AIContractValidationError('analyzed_at', 'Must be a valid ISO 8601 timestamp')
  }

  assertString(root.model_id, 'model_id', 64)
  if (!/^[a-zA-Z0-9.-]+$/.test(root.model_id)) {
    throw new AIContractValidationError('model_id', 'Invalid characters in model_id')
  }

  assertString(root.summary, 'summary', 4000)

  assertArray(root.warnings, 'warnings')
  for (let i = 0; i < root.warnings.length; i++) {
    assertString(root.warnings[i], `warnings[${i}]`, 1000)
  }

  // Validate image audit
  assertArray(root.image_audit, 'image_audit')
  for (let i = 0; i < root.image_audit.length; i++) {
    const item = root.image_audit[i] as Record<string, unknown>
    const p = `image_audit[${i}]`
    if (!item || typeof item !== 'object') throw new AIContractValidationError(p, 'Must be an object')
    assertExactKeys(item, ALLOWED_IMAGE_AUDIT_KEYS, p)

    assertPhotoIndex(item.photo_index, `${p}.photo_index`, photoCount)
    assertEnum(item.roof_visibility, ['full', 'partial', 'minimal', 'none'] as const, `${p}.roof_visibility`)
    assertEnum(item.quality, ['clear', 'blurry', 'glare', 'underexposed', 'overexposed', 'low_resolution'] as const, `${p}.quality`)
    assertEnum(item.perspective, ['ground_level', 'ladder_level', 'roof_level', 'aerial', 'excessive_angle'] as const, `${p}.perspective`)

    assertArray(item.obstructions, `${p}.obstructions`)
    for (let j = 0; j < item.obstructions.length; j++) {
      assertEnum(item.obstructions[j], ['trees_foliage', 'power_lines', 'shadows', 'snow_ice', 'equipment', 'none'] as const, `${p}.obstructions[${j}]`)
    }

    if (typeof item.is_duplicate_or_near_duplicate !== 'boolean') throw new AIContractValidationError(`${p}.is_duplicate_or_near_duplicate`, 'Must be boolean')
    if (typeof item.usable_for_analysis !== 'boolean') throw new AIContractValidationError(`${p}.usable_for_analysis`, 'Must be boolean')
    if (typeof item.audit_notes !== 'string') throw new AIContractValidationError(`${p}.audit_notes`, 'Must be string')
  }

  // Validate roof classification
  if (!root.roof_classification || typeof root.roof_classification !== 'object') {
    throw new AIContractValidationError('roof_classification', 'Missing classification object')
  }
  const rc = root.roof_classification as Record<string, unknown>
  assertExactKeys(rc, ALLOWED_ROOF_CLASSIFICATION_KEYS, 'roof_classification')

  assertEnum(rc.roof_style, ['gable', 'hip', 'gambrel', 'mansard', 'shed', 'flat', 'complex_combination', 'none_visible', 'indeterminate'] as const, 'roof_classification.roof_style')
  assertEnum(rc.primary_material, ['architectural_shingle', '3_tab_shingle', 'metal_standing_seam', 'metal_corrugated', 'clay_tile', 'concrete_tile', 'slate', 'wood_shake', 'modified_bitumen', 'tpo_pvc_membrane', 'built_up_roof', 'other', 'indeterminate'] as const, 'roof_classification.primary_material')

  if (rc.secondary_material !== null) {
    assertEnum(rc.secondary_material, ['architectural_shingle', '3_tab_shingle', 'metal_standing_seam', 'metal_corrugated', 'clay_tile', 'concrete_tile', 'slate', 'wood_shake', 'modified_bitumen', 'tpo_pvc_membrane', 'built_up_roof', 'other', 'indeterminate'] as const, 'roof_classification.secondary_material')
  }
  assertEnum(rc.apparent_condition, ['good', 'fair', 'poor', 'severe_distress', 'indeterminate'] as const, 'roof_classification.apparent_condition')
  assertEnum(rc.complexity_class, ['simple', 'moderate', 'complex', 'cut_up'] as const, 'roof_classification.complexity_class')
  assertEnum(rc.confidence, ['low', 'medium', 'high'] as const, 'roof_classification.confidence')

  // Validate facet observations & index defined facet IDs
  assertArray(root.facet_observations, 'facet_observations')
  const definedFacetIds = new Set<string>()

  for (let i = 0; i < root.facet_observations.length; i++) {
    const f = root.facet_observations[i] as Record<string, unknown>
    const p = `facet_observations[${i}]`
    if (!f || typeof f !== 'object') throw new AIContractValidationError(p, 'Must be an object')
    assertExactKeys(f, ALLOWED_FACET_KEYS, p)

    assertString(f.facet_id, `${p}.facet_id`, 64)
    if (!/^facet_[a-zA-Z0-9_-]+$/.test(f.facet_id)) {
      throw new AIContractValidationError(`${p}.facet_id`, 'Facet ID must match /^facet_[a-zA-Z0-9_-]+$/')
    }
    if (definedFacetIds.has(f.facet_id)) {
      throw new AIContractValidationError(`${p}.facet_id`, `Duplicate facet_id "${f.facet_id}"`)
    }
    definedFacetIds.add(f.facet_id)

    assertString(f.label, `${p}.label`, 128)
    assertEnum(f.facet_type, ['main_pitch', 'dormer', 'porch', 'shed', 'addition', 'other'] as const, `${p}.facet_type`)
    assertEnum(f.orientation, ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'indeterminate'] as const, `${p}.orientation`)
    assertEnum(f.pitch_class, ['flat', 'low_slope', 'standard', 'steep', 'extreme', 'indeterminate'] as const, `${p}.pitch_class`)

    assertString(f.apparent_pitch, `${p}.apparent_pitch`, 100)
    if (AUTHORITATIVE_PITCH_TERMS.test(f.apparent_pitch)) {
      throw new AIContractValidationError(`${p}.apparent_pitch`, 'Authoritative pitch claims forbidden in apparent_pitch')
    }

    assertEnum(f.confidence, ['low', 'medium', 'high'] as const, `${p}.confidence`)
    assertEnum(f.measurement_status, ['estimated', 'observed', 'unavailable'] as const, `${p}.measurement_status`)

    assertArray(f.source_photo_indices, `${p}.source_photo_indices`)
    for (let j = 0; j < f.source_photo_indices.length; j++) {
      assertPhotoIndex(f.source_photo_indices[j], `${p}.source_photo_indices[${j}]`, photoCount)
    }
    if (typeof f.notes !== 'string') throw new AIContractValidationError(`${p}.notes`, 'Must be string')
  }

  // Validate edge observations
  assertArray(root.edge_observations, 'edge_observations')
  for (let i = 0; i < root.edge_observations.length; i++) {
    const e = root.edge_observations[i] as Record<string, unknown>
    const p = `edge_observations[${i}]`
    if (!e || typeof e !== 'object') throw new AIContractValidationError(p, 'Must be an object')
    assertExactKeys(e, ALLOWED_EDGE_KEYS, p)

    assertString(e.edge_id, `${p}.edge_id`, 64)
    assertEnum(e.edge_type, ['eave', 'rake', 'ridge', 'hip', 'valley', 'wall_flashing', 'step_flashing', 'transition'] as const, `${p}.edge_type`)

    assertArray(e.adjacent_facet_ids, `${p}.adjacent_facet_ids`)
    for (let j = 0; j < e.adjacent_facet_ids.length; j++) {
      const facetId = e.adjacent_facet_ids[j]
      assertString(facetId, `${p}.adjacent_facet_ids[${j}]`)
      if (!definedFacetIds.has(facetId)) {
        throw new AIContractValidationError(`${p}.adjacent_facet_ids[${j}]`, `Referenced facet_id "${facetId}" is not declared`)
      }
    }

    assertEnum(e.visible_condition, ['intact', 'damaged', 'aged', 'occluded', 'indeterminate'] as const, `${p}.visible_condition`)
    assertEnum(e.confidence, ['low', 'medium', 'high'] as const, `${p}.confidence`)

    assertArray(e.source_photo_indices, `${p}.source_photo_indices`)
    for (let j = 0; j < e.source_photo_indices.length; j++) {
      assertPhotoIndex(e.source_photo_indices[j], `${p}.source_photo_indices[${j}]`, photoCount)
    }
    if (typeof e.notes !== 'string') throw new AIContractValidationError(`${p}.notes`, 'Must be string')
  }

  // Validate penetration observations
  assertArray(root.penetration_observations, 'penetration_observations')
  for (let i = 0; i < root.penetration_observations.length; i++) {
    const pen = root.penetration_observations[i] as Record<string, unknown>
    const p = `penetration_observations[${i}]`
    if (!pen || typeof pen !== 'object') throw new AIContractValidationError(p, 'Must be an object')
    assertExactKeys(pen, ALLOWED_PENETRATION_KEYS, p)

    assertString(pen.penetration_id, `${p}.penetration_id`, 64)
    assertEnum(pen.penetration_type, ['plumbing_vent_pipe', 'hvac_flue', 'box_vent', 'ridge_vent', 'power_attic_vent', 'chimney', 'skylight', 'satellite_dish', 'solar_panel', 'other'] as const, `${p}.penetration_type`)

    if (pen.associated_facet_id !== null) {
      assertString(pen.associated_facet_id, `${p}.associated_facet_id`)
      if (!definedFacetIds.has(pen.associated_facet_id)) {
        throw new AIContractValidationError(`${p}.associated_facet_id`, `Referenced facet_id "${pen.associated_facet_id}" is not declared`)
      }
    }

    assertEnum(pen.visible_condition, ['good', 'flashing_damaged', 'cracked_boot', 'deteriorated', 'indeterminate'] as const, `${p}.visible_condition`)
    assertEnum(pen.confidence, ['low', 'medium', 'high'] as const, `${p}.confidence`)

    assertArray(pen.source_photo_indices, `${p}.source_photo_indices`)
    for (let j = 0; j < pen.source_photo_indices.length; j++) {
      assertPhotoIndex(pen.source_photo_indices[j], `${p}.source_photo_indices[${j}]`, photoCount)
    }
    if (typeof pen.notes !== 'string') throw new AIContractValidationError(`${p}.notes`, 'Must be string')
  }

  // Validate damage observations
  assertArray(root.damage_observations, 'damage_observations')
  for (let i = 0; i < root.damage_observations.length; i++) {
    const d = root.damage_observations[i] as Record<string, unknown>
    const p = `damage_observations[${i}]`
    if (!d || typeof d !== 'object') throw new AIContractValidationError(p, 'Must be an object')
    assertExactKeys(d, ALLOWED_DAMAGE_KEYS, p)

    assertString(d.damage_id, `${p}.damage_id`, 64)
    assertEnum(d.observation_type, ['observed', 'inferred'] as const, `${p}.observation_type`)
    assertEnum(d.category, ['missing_shingles', 'creased_shingles', 'hail_impact_marks', 'granule_loss', 'wind_lift', 'tree_strike', 'debris', 'corrosion', 'flashing_failure', 'moss_algae', 'wear_aging', 'indeterminate'] as const, `${p}.category`)
    assertEnum(d.severity, ['superficial', 'moderate', 'severe', 'indeterminate'] as const, `${p}.severity`)

    assertString(d.location_description, `${p}.location_description`, 256)
    if (AUTHORITATIVE_CLAIM_TERMS.test(d.location_description)) {
      throw new AIContractValidationError(`${p}.location_description`, 'Prohibited commercial/claim terms in location_description')
    }

    if (d.associated_facet_id !== null) {
      assertString(d.associated_facet_id, `${p}.associated_facet_id`)
      if (!definedFacetIds.has(d.associated_facet_id)) {
        throw new AIContractValidationError(`${p}.associated_facet_id`, `Referenced facet_id "${d.associated_facet_id}" is not declared`)
      }
    }

    assertEnum(d.confidence, ['low', 'medium', 'high'] as const, `${p}.confidence`)

    assertArray(d.source_photo_indices, `${p}.source_photo_indices`)
    if (d.source_photo_indices.length === 0) {
      throw new AIContractValidationError(`${p}.source_photo_indices`, 'Damage observation must reference at least one source photo')
    }
    for (let j = 0; j < d.source_photo_indices.length; j++) {
      assertPhotoIndex(d.source_photo_indices[j], `${p}.source_photo_indices[${j}]`, photoCount)
    }

    if (typeof d.notes !== 'string') throw new AIContractValidationError(`${p}.notes`, 'Must be string')
    if (AUTHORITATIVE_CLAIM_TERMS.test(d.notes)) {
      throw new AIContractValidationError(`${p}.notes`, 'Prohibited commercial/claim terms in notes')
    }
  }

  // Narrative strings are untrusted model output; enforce safety rules across every prose field.
  assertNoUnsafeNarrativeText(data, 'root')

  return data as RoofAIObservationPacket
}
