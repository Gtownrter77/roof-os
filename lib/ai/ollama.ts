export type OllamaRequestOptions = {
  model?: string
  timeoutMs?: number
  format?: 'json'
}

export type OllamaJsonResult<T> = { model: string; value: T }

const DEFAULT_HOST = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'llama3:8b'
const DEFAULT_TIMEOUT_MS = 1_500
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000

let lastOllamaFailure = 0

function isOllamaCircuitOpen(): boolean {
  return Date.now() - lastOllamaFailure < CIRCUIT_BREAKER_COOLDOWN_MS
}

function recordOllamaSuccess(): void {
  lastOllamaFailure = 0
}

function recordOllamaFailure(): void {
  lastOllamaFailure = Date.now()
}

function ollamaHost() {
  return (process.env.OLLAMA_HOST?.trim() || DEFAULT_HOST).replace(/\/$/, '')
}

function ollamaModel(model?: string) {
  return model?.trim() || process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL
}

export function isLlamaAgentEnabled() {
  return process.env.LLAMA_AGENT_ENABLED?.trim().toLowerCase() === 'true'
}

export async function askOllama(prompt: string, options: OllamaRequestOptions = {}): Promise<string | null> {
  // If the circuit breaker is open (Ollama offline/unreachable recently), fail fast in 0ms
  if (isOllamaCircuitOpen()) {
    return null
  }

  const model = ollamaModel(options.model)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${ollamaHost()}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        ...(options.format ? { format: options.format } : {}),
        stream: false,
      }),
    })

    if (!response.ok) {
      recordOllamaFailure()
      return null
    }

    const data = await response.json() as { response?: unknown }
    const text = typeof data.response === 'string' && data.response.trim() ? data.response.trim() : null
    if (text) {
      recordOllamaSuccess()
    }
    return text
  } catch {
    recordOllamaFailure()
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function askOllamaJson<T>(prompt: string, options: OllamaRequestOptions = {}): Promise<OllamaJsonResult<T> | null> {
  const model = ollamaModel(options.model)
  const response = await askOllama(prompt, { ...options, model, format: 'json' })
  if (!response) return null
  try {
    return { model, value: JSON.parse(response) as T }
  } catch {
    return null
  }
}
