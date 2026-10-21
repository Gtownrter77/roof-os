const DEFAULT_BASE_URL = 'http://localhost:20128/v1'
const DEFAULT_MODEL = 'qwen3-vl:8b'
const DEFAULT_TIMEOUT_MS = 90_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class LocalVisionError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'LocalVisionError'
    this.status = status
  }
}

export function getOllamaVisionApiBaseUrl() {
  const configured = process.env.OLLAMA_VISION_API_BASE_URL?.trim() || DEFAULT_BASE_URL
  let url
  try {
    url = new URL(configured)
  } catch {
    throw new LocalVisionError(503, 'The local vision API base URL is invalid.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new LocalVisionError(503, 'The local vision API base URL is invalid.')
  }
  return url.toString().replace(/\/+$/, '')
}

export function getOllamaVisionModel() {
  return process.env.OLLAMA_VISION_MODEL?.trim() || DEFAULT_MODEL
}

async function readBoundedText(response) {
  const lengthHeader = response.headers.get('content-length')
  if (lengthHeader && /^\d+$/.test(lengthHeader) && Number(lengthHeader) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    throw new LocalVisionError(502, 'The local vision response exceeded the allowed size.')
  }
  if (!response.body) throw new LocalVisionError(502, 'The local vision service returned no response body.')

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
        throw new LocalVisionError(502, 'The local vision response exceeded the allowed size.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size).toString('utf8')
}

function imageContent(photo) {
  if (!photo || !SUPPORTED_IMAGE_TYPES.has(photo.mimeType) || !(photo.bytes instanceof Uint8Array)) {
    throw new LocalVisionError(400, 'Local vision requires JPEG, PNG, or WebP image bytes.')
  }
  const base64 = Buffer.from(photo.bytes).toString('base64')
  return { type: 'image_url', image_url: { url: `data:${photo.mimeType};base64,${base64}` } }
}

function extractMessageText(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => part && typeof part === 'object' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim()
}

export async function analyzePhotosWithOllama({ prompt, photos, model, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new LocalVisionError(400, 'A local vision prompt is required.')
  }
  if (!Array.isArray(photos) || photos.length < 1) {
    throw new LocalVisionError(400, 'At least one image is required for local vision.')
  }

  const visionModel = typeof model === 'string' && model.trim() ? model.trim() : getOllamaVisionModel()
  const baseUrl = getOllamaVisionApiBaseUrl()
  const endpoint = `${baseUrl}/chat/completions`
  const controller = new AbortController()
  const boundedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(timeoutMs, 120_000)
    : DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), boundedTimeout)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
      body: JSON.stringify({
        model: visionModel,
        stream: false,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...photos.map(imageContent),
          ],
        }],
      }),
    })

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new LocalVisionError(response.status === 429 || response.status >= 500 ? 503 : 502, 'The local vision service could not complete the analysis.')
    }

    let payload
    try {
      payload = JSON.parse(await readBoundedText(response))
    } catch (error) {
      if (error instanceof LocalVisionError) throw error
      throw new LocalVisionError(502, 'The local vision service returned invalid JSON.')
    }

    const text = extractMessageText(payload?.choices?.[0]?.message?.content)
    if (!text) throw new LocalVisionError(502, 'The local vision service returned no analysis text.')
    return { model: visionModel, text }
  } catch (error) {
    if (error instanceof LocalVisionError) throw error
    if (controller.signal.aborted) throw new LocalVisionError(504, 'Local vision analysis timed out.')
    throw new LocalVisionError(503, 'The local vision service is unavailable.')
  } finally {
    clearTimeout(timer)
  }
}
