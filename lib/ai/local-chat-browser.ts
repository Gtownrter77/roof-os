const DEFAULT_API_BASE_URL = 'http://localhost:11434/v1'
const DEFAULT_MODEL = 'llama3:8b'
const MAX_RESPONSE_BYTES = 256 * 1024
const REQUEST_TIMEOUT_MS = 60_000
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export type BrowserLocalChatInput = {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  currentPath?: string
  suggestedAction?: { label: string; href: string }
}

export function getLocalChatEndpoint() {
  const raw = process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !LOCAL_HOSTS.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) return null
  return url.toString().replace(/\/+$/, '')
}

export function getLocalChatModel() {
  return process.env.NEXT_PUBLIC_OLLAMA_CHAT_MODEL?.trim() || DEFAULT_MODEL
}

/**
 * Runs chat inference directly from the user's browser to Ollama on that
 * same desktop. It must never be moved into a server API route: server-side
 * localhost points at the hosting machine, not the user's computer.
 */
export async function askBrowserLocalOllama(input: BrowserLocalChatInput): Promise<string | null> {
  const endpoint = getLocalChatEndpoint()
  const message = typeof input.message === 'string' ? input.message.trim().slice(0, 2_000) : ''
  if (!endpoint || !message) return null

  const history = (input.history ?? [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 1_000) }))

  const context = [
    input.currentPath ? `Current ROOF/OS page: ${input.currentPath.slice(0, 200)}` : '',
    input.suggestedAction
      ? `Relevant screen: ${input.suggestedAction.label} (${input.suggestedAction.href})`
      : '',
  ].filter(Boolean).join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      body: JSON.stringify({
        model: getLocalChatModel(),
        stream: false,
        temperature: 0.2,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: 'You are the ROOF/OS operations copilot. Answer in at most two concise sentences. Never invent prices, coverage decisions, measurements, claim outcomes, or customer records. Do not claim to have changed data. If a relevant screen is provided, orient the user to it. You are running locally on the user’s own computer.',
          },
          ...history,
          { role: 'user', content: [context, message].filter(Boolean).join('\n\n') },
        ],
      }),
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      return null
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined)
      return null
    }
    const responseText = await response.text()
    if (new TextEncoder().encode(responseText).byteLength > MAX_RESPONSE_BYTES) return null

    const payload = JSON.parse(responseText) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const reply = payload.choices?.[0]?.message?.content
    return typeof reply === 'string' && reply.trim() ? reply.trim().slice(0, 2_000) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
