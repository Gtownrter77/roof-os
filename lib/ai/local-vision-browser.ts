import { GEOMETRY_CONTRACT_VERSION, validateGeometrySuggestion } from './geometry-contract'
import type { GeometrySuggestion } from './geometry-contract'

const DEFAULT_API_BASE_URL = 'http://localhost:20128/v1'
const DEFAULT_MODEL = 'qwen3-vl:8b'
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 90_000
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export class BrowserLocalVisionError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'BrowserLocalVisionError'
  }
}

export type BrowserVisionResult = { model: string; suggestion: GeometrySuggestion }

function getLocalEndpoint() {
  const raw = process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new BrowserLocalVisionError('The local vision URL is invalid.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.search || url.hash) {
    throw new BrowserLocalVisionError('Local-only vision accepts only a loopback URL such as http://localhost:20128/v1.')
  }
  return url.toString().replace(/\/+$/, '')
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function readBoundedResponse(response: Response) {
  const contentLength = response.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new BrowserLocalVisionError('Local vision returned an oversized response.', 502)
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new BrowserLocalVisionError('Local vision returned an oversized response.', 502)
  }
  return text
}

function geometryPrompt() {
  return `Analyze this actual roof image as an assistant only. Return exactly one JSON object matching ROOF/OS geometry contract ${GEOMETRY_CONTRACT_VERSION}. Coordinates must be pixels in the supplied image. Suggest roof planes as non-self-intersecting polygons, roof edges with classifications eave/rake/ridge/hip/valley/transition/step_flashing/other, and roof objects with types skylight/chimney/hvac/pipe_boot/attic_vent/other. Use low/medium/high confidence as a qualitative label, not a calibrated probability. Do not invent scale, feet, square feet, roofing squares, linear feet, quantities, or confirmed measurements. If the roof is not clearly visible, return empty arrays and a warning. No Markdown or extra keys.`
}

export async function analyzeRoofImageWithLocalOllama(file: File, imageWidth: number, imageHeight: number): Promise<BrowserVisionResult> {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new BrowserLocalVisionError('Choose a JPEG, PNG, or WebP roof image.')
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new BrowserLocalVisionError('The selected image must be between 1 byte and 30 MB.', 413)
  }
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth < 1 || imageHeight < 1 || imageWidth > 100_000 || imageHeight > 100_000) {
    throw new BrowserLocalVisionError('Valid image dimensions are required.')
  }

  const endpoint = `${getLocalEndpoint()}/chat/completions`
  const model = process.env.NEXT_PUBLIC_OLLAMA_VISION_MODEL?.trim() || DEFAULT_MODEL
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'text', text: geometryPrompt() },
          { type: 'image_url', image_url: { url: `data:${file.type};base64,${toBase64(bytes)}` } },
        ] }],
      }),
    })

    if (!response.ok) throw new BrowserLocalVisionError(`Local vision returned HTTP ${response.status}.`, response.status)
    let payload: unknown
    try {
      payload = JSON.parse(await readBoundedResponse(response))
    } catch (error) {
      if (error instanceof BrowserLocalVisionError) throw error
      throw new BrowserLocalVisionError('Local vision returned invalid JSON.', 502)
    }
    const text = (payload as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) throw new BrowserLocalVisionError('Local vision returned no geometry suggestion.', 502)

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new BrowserLocalVisionError('Local vision returned malformed geometry JSON.', 502)
    }
    let suggestion: GeometrySuggestion
    try {
      suggestion = validateGeometrySuggestion(parsed)
    } catch {
      throw new BrowserLocalVisionError('Local vision returned geometry that failed the ROOF/OS contract.', 502)
    }
    if (suggestion.image_width !== imageWidth || suggestion.image_height !== imageHeight) {
      throw new BrowserLocalVisionError('Local vision returned geometry for different image dimensions.', 502)
    }
    return { model, suggestion }
  } catch (error) {
    if (error instanceof BrowserLocalVisionError) throw error
    if (controller.signal.aborted) throw new BrowserLocalVisionError('Local vision timed out. The selected image was not uploaded.')
    if (error instanceof TypeError) {
      throw new BrowserLocalVisionError('Could not reach localhost:20128. Start the local vision service and allow this app origin through its CORS/private-network settings; no hosted AI fallback is used.')
    }
    throw new BrowserLocalVisionError('Local vision failed before the image was uploaded.')
  } finally {
    window.clearTimeout(timeout)
  }
}
