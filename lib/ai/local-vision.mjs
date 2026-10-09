const DEFAULT_HOST = 'http://127.0.0.1:11434'

export async function analyzePhotosWithOllama({ prompt, photos, model, timeoutMs }) {
  const host = (process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/$/, '')
  const visionModel = model || process.env.OLLAMA_VISION_MODEL || 'llava'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: visionModel,
        stream: false,
        format: 'json',
        messages: [{
          role: 'user',
          content: prompt,
          images: photos.map((photo) => photo.bytes.toString('base64')),
        }],
      }),
    })
    if (!response.ok) {
      throw new Error(`Local vision failed (${response.status}).`)
    }
    const payload = await response.json()
    const text = payload?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Local vision returned no analysis.')
    }
    return { model: visionModel, text }
  } finally {
    clearTimeout(timer)
  }
}
