export interface LocalVisionPhoto {
  mimeType: string
  bytes: Uint8Array
}

export interface LocalVisionResult {
  model: string
  text: string
}

export class LocalVisionError extends Error {
  readonly status: number
}

export function getOllamaVisionApiBaseUrl(): string
export function getOllamaVisionModel(): string
export function analyzePhotosWithOllama(input: {
  prompt: string
  photos: LocalVisionPhoto[]
  model?: string
  timeoutMs?: number
}): Promise<LocalVisionResult>
