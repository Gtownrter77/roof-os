const DEFAULT_MODEL = 'gemini-3.8-flash'
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class GeminiVisionError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'GeminiVisionError'
    this.status = status
  }
}

export function getGeminiVisionModel() {
  return process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_MODEL
}

async function readBoundedJson(response) {
  const length = response.headers.get('content-length')
  if (length && /^\\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    throw new GeminiVisionError(502, 'Gemini returned an oversized response.')
  }
  if (!response.body) throw new GeminiVisionError(502, 'Gemini returned an empty response.')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new GeminiVisionError(502, 'Gemini returned an oversized response.')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } catch {
    throw new GeminiVisionError(502, 'Gemini returned malformed JSON.')
  }
}

export async function analyzeRoofGeometryWithGemini({ prompt, photo, timeoutMs = 90_000 }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new GeminiVisionError(503, 'Hosted roof detection is not configured on this deployment.')
  if (typeof prompt !== 'string' || !prompt.trim()) throw new GeminiVisionError(400, 'A roof geometry prompt is required.')
  if (!photo || !SUPPORTED_IMAGE_TYPES.has(photo.mimeType) || !(photo.bytes instanceof Uint8Array) || photo.bytes.byteLength < 1) {
    throw new GeminiVisionError(400, 'Gemini roof detection requires a valid JPEG, PNG, or WebP image.')
  }

  const model = getGeminiVisionModel()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
        accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are a roof-image geometry assistant. Follow the supplied ROOF/OS geometry contract exactly. Never invent scale or measurements.' }] },
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: photo.mimeType, data: Buffer.from(photo.bytes).toString('base64') } },
          ],
        }],
        generationConfig: {
          candidateCount: 1,
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    })
    if (!response.ok) {
      if (response.status === 429) throw new GeminiVisionError(429, 'Roof AI is busy or has reached its usage limit. Please wait and try again.')
      if (response.status === 401 || response.status === 403) throw new GeminiVisionError(503, 'The hosted roof AI credential was rejected. Manual tracing remains available.')
      throw new GeminiVisionError(502, 'Google Gemini could not analyze this roof image. Manual tracing remains available.')
    }
    const payload = await readBoundedJson(response)
    const parts = payload?.candidates?.[0]?.content?.parts
    const text = Array.isArray(parts) ? parts.filter((part) => typeof part?.text === 'string').map((part) => part.text).join('').trim() : ''
    if (!text) throw new GeminiVisionError(502, 'Gemini returned no roof geometry. Manual tracing remains available.')
    return { model, text }
  } catch (error) {
    if (error instanceof GeminiVisionError) throw error
    if (controller.signal.aborted) throw new GeminiVisionError(504, 'Roof AI timed out. Manual tracing remains available.')
    throw new GeminiVisionError(503, 'Google Gemini could not be reached. Manual tracing remains available.')
  } finally {
    clearTimeout(timer)
  }
}
