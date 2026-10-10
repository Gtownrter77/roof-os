import { askOllamaJson, isLlamaAgentEnabled } from '../lib/ai/ollama'

export type LlamaAgentResult<T> = {
  model: string
  promptVersion: string
  output: T
}

export async function runLlamaAgentJson<T>(input: {
  agentKey: string
  promptVersion: string
  instruction: string
  input: Record<string, unknown>
  timeoutMs?: number
}): Promise<LlamaAgentResult<T> | null> {
  if (!isLlamaAgentEnabled()) return null
  const result = await askOllamaJson<T>([
    `You are the optional ${input.agentKey} assistant for ROOF/OS.`,
    'Return only valid JSON matching the requested shape.',
    'Your output is advisory only. Do not make authorization, pricing, measurement, approval, payment, scheduling, or customer-contact decisions.',
    `Prompt version: ${input.promptVersion}`,
    input.instruction,
    `Input JSON: ${JSON.stringify(input.input)}`,
  ].join('\n'), { timeoutMs: input.timeoutMs ?? 2_500 })
  if (!result) return null
  return { model: result.model, promptVersion: input.promptVersion, output: result.value }
}
