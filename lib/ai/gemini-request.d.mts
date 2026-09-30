export interface GeminiGenerateContentRequest {
  url: string
  init: RequestInit
}

export function createGeminiGenerateContentRequest(
  modelId: string,
  apiKey: string,
  payload: unknown,
): GeminiGenerateContentRequest
