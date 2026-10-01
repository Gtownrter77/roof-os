const GEMINI_API_ORIGIN = 'https://generativelanguage.googleapis.com'

export function createGeminiGenerateContentRequest(modelId, apiKey, payload) {
  const normalizedModelId = typeof modelId === 'string' ? modelId.trim() : ''
  const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
  if (!/^[a-z0-9.-]+$/i.test(normalizedModelId)) {
    throw new TypeError('Gemini model identifier is invalid.')
  }
  if (!normalizedApiKey) throw new TypeError('Gemini API key is required.')

  const url = new URL(`/v1beta/models/${normalizedModelId}:generateContent`, GEMINI_API_ORIGIN)
  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': normalizedApiKey,
      },
      body: JSON.stringify(payload),
    },
  }
}
