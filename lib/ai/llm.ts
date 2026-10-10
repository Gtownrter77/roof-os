import { askOllama, askOllamaJson, type OllamaJsonResult, type OllamaRequestOptions } from './ollama.ts'

export type LlmRequestOptions = OllamaRequestOptions & {
  /** Prefer SpaceXAI even when Ollama is configured. Default true when XAI_API_KEY is set. */
  preferCloud?: boolean
}

export type LlmJsonResult<T> = OllamaJsonResult<T>

const XAI_BASE_URL = 'https://api.x.ai/v1'
const DEFAULT_XAI_MODEL = 'grok-4.7'
const DEFAULT_XAI_TIMEOUT_MS = 20_000

function xaiApiKey() {
  return process.env.XAI_API_KEY?.trim() || ''
}

function xaiModel(model?: string) {
  return model?.trim() || process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL
}

/** True when cloud SpaceXAI or explicit local Llama agent opt-in is available. */
export function isModelAgentEnabled() {
  if (xaiApiKey()) return true
  return process.env.LLAMA_AGENT_ENABLED?.trim().toLowerCase() === 'true'
}

async function askSpaceXai(prompt: string, options: LlmRequestOptions = {}): Promise<string | null> {
  const apiKey = xaiApiKey()
  if (!apiKey) return null

  const model = xaiModel(options.model)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_XAI_TIMEOUT_MS)

  try {
    const body: Record<string, unknown> = {
      model,
      stream: false,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }
    if (options.format === 'json') {
      body.response_format = { type: 'json_object' }
    }

    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    return typeof content === 'string' && content.trim() ? content.trim() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Production text generation: SpaceXAI (api.x.ai) when XAI_API_KEY is set,
 * otherwise local Ollama. Returns null when neither provider answers.
 */
export async function askLlm(prompt: string, options: LlmRequestOptions = {}): Promise<string | null> {
  const preferCloud = options.preferCloud !== false
  if (preferCloud && xaiApiKey()) {
    const cloud = await askSpaceXai(prompt, options)
    if (cloud) return cloud
  }

  const local = await askOllama(prompt, options)
  if (local) return local

  if (!preferCloud && xaiApiKey()) {
    return askSpaceXai(prompt, options)
  }
  return null
}

export async function askLlmJson<T>(
  prompt: string,
  options: LlmRequestOptions = {},
): Promise<LlmJsonResult<T> | null> {
  const preferCloud = options.preferCloud !== false
  const modelForCloud = xaiModel(options.model)

  if (preferCloud && xaiApiKey()) {
    const response = await askSpaceXai(prompt, { ...options, format: 'json' })
    if (response) {
      try {
        return { model: modelForCloud, value: JSON.parse(response) as T }
      } catch {
        // fall through to Ollama / retry without forcing parse
      }
    }
  }

  const local = await askOllamaJson<T>(prompt, options)
  if (local) return local

  if (!preferCloud && xaiApiKey()) {
    const response = await askSpaceXai(prompt, { ...options, format: 'json' })
    if (!response) return null
    try {
      return { model: modelForCloud, value: JSON.parse(response) as T }
    } catch {
      return null
    }
  }

  return null
}
