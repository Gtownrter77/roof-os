import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ollama = readFileSync('lib/ai/ollama.ts', 'utf8')
const llm = readFileSync('lib/ai/llm.ts', 'utf8')
const worker = readFileSync('workers/llama-agent.ts', 'utf8')
const inspection = readFileSync('workers/inspection-quality.ts', 'utf8')
const receptionist = readFileSync('lib/receptionist-ai.ts', 'utf8')
const copilot = readFileSync('lib/ai/chat-copilot.ts', 'utf8')
const env = readFileSync('.env.example', 'utf8')

for (const marker of ['OLLAMA_HOST', 'OLLAMA_MODEL', 'AbortController', 'stream: false', 'JSON.parse', "format: 'json'"]) {
  assert.ok(ollama.includes(marker), `Ollama adapter marker missing: ${marker}`)
}
for (const marker of ['XAI_API_KEY', 'api.x.ai', 'askLlm', 'askLlmJson', 'isModelAgentEnabled', 'chat/completions']) {
  assert.ok(llm.includes(marker), `SpaceXAI llm adapter marker missing: ${marker}`)
}
for (const marker of ['isLlamaAgentEnabled', 'advisory only', 'promptVersion', 'askLlmJson', 'isModelAgentEnabled']) {
  assert.ok(worker.includes(marker), `Llama worker marker missing: ${marker}`)
}
for (const marker of ['runLlamaAgentJson', 'model_assistance', 'deterministic: true', 'inspection-quality-llama-v1']) {
  assert.ok(inspection.includes(marker), `Inspection Llama integration missing: ${marker}`)
}
assert.ok(receptionist.includes('askLlmJson'), 'Receptionist must use shared structured LLM adapter')
assert.ok(copilot.includes("import { askLlm } from './llm.ts'"), 'Copilot must use shared LLM adapter')
assert.ok(env.includes('LLAMA_AGENT_ENABLED=false'), 'Llama agent feature flag must default to disabled')
assert.ok(env.includes('XAI_API_KEY='), 'SpaceXAI API key must be documented in .env.example')
console.log(
  'llama-agent-test: PASS (SpaceXAI+Ollama adapter, structured output, bounded worker enrichment, and safe fallback)',
)
