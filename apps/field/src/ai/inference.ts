export type AiObservationType =
  | 'photo_quality'
  | 'component_detection'
  | 'component_segmentation'
  | 'roof_type'
  | 'measurement_suggestion'
  | 'missing_view'

export type AiInferenceInput = {
  localUri: string
  sourcePhotoId: string | null
  width: number | null
  height: number | null
  mimeType: string
}

export type AiObservationSuggestion = {
  observationType: AiObservationType
  component: string | null
  suggestedValue: Record<string, unknown>
  unit: string | null
  confidence: number | null
  sourceGeometry: Record<string, unknown>
}

export type AiInferenceResult = {
  modelId: string
  modelVersion: string
  observations: AiObservationSuggestion[]
  latencyMs: number
}

export type AiInferenceAdapter = {
  requestedEnabled: boolean
  runtimeAvailable: boolean
  modelLoaded: boolean
  isEnabled: boolean
  inferPhoto: (input: AiInferenceInput) => Promise<AiInferenceResult | null>
}

const requestedModelId = 'roof-components'
const requestedModelVersion = 'unavailable'
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateInferenceInput(input: AiInferenceInput): void {
  if (!input.localUri.trim()) throw new Error('An image URI is required for inference.')
  if (!supportedMimeTypes.has(input.mimeType.toLowerCase())) throw new Error('Unsupported image type for inference.')
  if (input.width !== null && (!Number.isInteger(input.width) || input.width <= 0)) throw new Error('Image width must be a positive integer.')
  if (input.height !== null && (!Number.isInteger(input.height) || input.height <= 0)) throw new Error('Image height must be a positive integer.')
}

export function validateInferenceResult(result: AiInferenceResult): void {
  if (!result.modelId.trim() || !result.modelVersion.trim()) throw new Error('Inference provenance is required.')
  if (!Number.isFinite(result.latencyMs) || result.latencyMs < 0) throw new Error('Inference latency must be non-negative.')
  for (const observation of result.observations) {
    if (observation.confidence !== null && (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1)) {
      throw new Error('Inference confidence must be between 0 and 1.')
    }
    if (!observation.suggestedValue || typeof observation.suggestedValue !== 'object') throw new Error('Inference values must be objects.')
    if (!observation.sourceGeometry || typeof observation.sourceGeometry !== 'object') throw new Error('Inference geometry must be an object.')
  }
}

/** Disabled until a reviewed native runtime and checksum-verified model are bundled. */
export function createInferenceAdapter(): AiInferenceAdapter {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  const requestedEnabled = env.EXPO_PUBLIC_ON_DEVICE_AI_ENABLED === 'true'
  const runtimeAvailable = false
  const modelLoaded = false
  const isEnabled = requestedEnabled && runtimeAvailable && modelLoaded

  return {
    requestedEnabled,
    runtimeAvailable,
    modelLoaded,
    isEnabled,
    async inferPhoto(input) {
      validateInferenceInput(input)
      if (!isEnabled) return null
      // The native runtime/model is intentionally not wired until its artifact,
      // input tensor contract, and device benchmark are approved.
      const result = {
        modelId: requestedModelId,
        modelVersion: requestedModelVersion,
        observations: [],
        latencyMs: 0,
      }
      validateInferenceResult(result)
      return result
    },
  }
}
