import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const ollama = readFileSync('lib/ai/ollama.ts', 'utf8')
const worker = readFileSync('workers/llama-agent.ts', 'utf8')
const inspection = readFileSync('workers/inspection-quality.ts', 'utf8')
const receptionist = readFileSync('lib/receptionist-ai.ts', 'utf8')
const copilot = readFileSync('lib/ai/chat-copilot.ts', 'utf8')
const env = readFileSync('.env.example', 'utf8')
const policy = readFileSync('NO-PAID-AI.md', 'utf8')

assert.equal(existsSync('lib/ai/llm.ts'), false, 'Hosted chat adapter must not ship')
for (const marker of ['OLLAMA_HOST', 'OLLAMA_MODEL', 'AbortController', 'stream: false', 'JSON.parse', "format: 'json'"]) {
  assert.ok(ollama.includes(marker), `Ollama adapter marker missing: ${marker}`)
}
for (const marker of ['isLlamaAgentEnabled', 'advisory only', 'promptVersion', 'askOllamaJson']) {
  assert.ok(worker.includes(marker), `Llama worker marker missing: ${marker}`)
}
for (const marker of ['runLlamaAgentJson', 'model_assistance', 'deterministic: true', 'inspection-quality-llama-v1']) {
  assert.ok(inspection.includes(marker), `Inspection Llama integration missing: ${marker}`)
}
assert.ok(!inspection.includes('XAI_API_KEY'), 'Inspection worker must not read a hosted chat key')
assert.ok(receptionist.includes('askOllamaJson'), 'Receptionist must use the local Ollama adapter')
assert.ok(copilot.includes("import { askOllama } from './ollama.ts'"), 'Copilot must use the local Ollama adapter')
assert.ok(!copilot.includes('api.x.ai'), 'Copilot must not call a hosted chat API')
assert.ok(env.includes('LLAMA_AGENT_ENABLED=false'), 'Llama agent feature flag must default to disabled')
assert.ok(!env.includes('XAI_API_KEY'), '.env.example must not document a hosted chat key')
assert.ok(policy.includes('does not call a hosted chat API'), 'Policy must keep text AI on the open stack')
console.log('llama-agent-test: PASS (local Ollama only, no hosted chat key)')
