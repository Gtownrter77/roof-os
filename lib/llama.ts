/**
 * Open-source vision/text client.
 * Default: local Ollama OpenAI-compatible endpoint.
 * Grok is not in this runtime.
 */

export type LlamaTarget = {
  url: string
  key: string
  model: string
}

export function llamaTarget(): LlamaTarget {
  const base = (process.env.LLAMA_VISION_URL || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const url = base.includes('/chat/completions') ? base : `${base}/v1/chat/completions`
  return {
    url,
    key: process.env.LLAMA_API_KEY || process.env.GROQ_API_KEY || '',
    model: process.env.LLAMA_VISION_MODEL || 'llava',
  }
}

export async function llamaVisionJson(imageDataUrl: string, prompt: string): Promise<{ text: string; model: string }> {
  const target = llamaTarget()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (target.key) headers.authorization = `Bearer ${target.key}`
  const res = await fetch(target.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: target.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Llama HTTP ${res.status}: ${detail.slice(0, 240)}`)
  }
  const payload = await res.json()
  return { text: payload.choices?.[0]?.message?.content ?? '', model: target.model }
}
