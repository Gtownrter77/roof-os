import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname

// 1. Verify Global Layout Mount
const layoutSource = readFileSync(join(root, 'app', 'layout.tsx'), 'utf8')
assert.ok(
  layoutSource.includes('AiChatBar'),
  'app/layout.tsx must import and render AiChatBar so it appears on every page'
)

// 2. Verify Client Component Contract
const componentSource = readFileSync(join(root, 'components', 'AiChatBar.tsx'), 'utf8')
assert.ok(
  componentSource.includes('What would you like to do now?'),
  'AiChatBar component must prompt: "What would you like to do now?"'
)
assert.ok(
  componentSource.includes('AI Copilot') || componentSource.includes('AI Assistant'),
  'AiChatBar must identify as AI Copilot'
)
assert.ok(
  componentSource.includes('role="region"'),
  'AiChatBar must include accessible region'
)
assert.ok(
  componentSource.includes('/api/ai/chat'),
  'AiChatBar must connect to /api/ai/chat'
)
for (const action of ['Track Storms', 'Review Leads', 'Aerial Measure', 'Create Estimate', 'Golden Report']) {
  assert.ok(
    componentSource.includes(action),
    `AiChatBar must provide quick action suggestion: ${action}`
  )
}
assert.ok(
  componentSource.includes('metaKey') && componentSource.includes("'k'"),
  'AiChatBar must support Cmd+K / Ctrl+K keyboard shortcut'
)

// 3. Verify API Route Security & Integrity
const routeSource = readFileSync(join(root, 'app', 'api', 'ai', 'chat', 'route.ts'), 'utf8')
assert.ok(
  routeSource.includes('getUser()'),
  'AI chat API route must contain user session check'
)
assert.ok(
  routeSource.includes('readJson'),
  'AI chat API route must use bounded JSON body reader'
)
assert.ok(
  !routeSource.includes('request.json()'),
  'AI chat API route must not bypass bounded reader'
)
assert.ok(
  [...routeSource.matchAll(/\bfetch\s*\(/g)].length === 0,
  'AI chat API route must not contain raw unbounded fetches'
)

// 4. Test Assistant Intelligence Processor Unit Tests
const { processChatCopilot } = await import('../lib/ai/chat-copilot.ts')

// Empty prompt check
const emptyResult = await processChatCopilot({ message: '' })
assert.ok(
  emptyResult.reply.includes('What would you like to do now?'),
  'Default assistant response must ask "What would you like to do now?"'
)

// Intent & navigation matching checks
const stormResult = await processChatCopilot({ message: 'I need to track the storm in Ohio' })
assert.equal(stormResult.suggestedAction?.href, '/weather')

const leadResult = await processChatCopilot({ message: 'show me my new leads' })
assert.equal(leadResult.suggestedAction?.href, '/leads')

const measureResult = await processChatCopilot({ message: 'calculate roof pitch and squares' })
assert.equal(measureResult.suggestedAction?.href, '/measure')

const estimateResult = await processChatCopilot({ message: 'create pricing estimate with lowes' })
assert.equal(estimateResult.suggestedAction?.href, '/pricing')

const reportResult = await processChatCopilot({ message: 'generate golden inspection report' })
assert.equal(reportResult.suggestedAction?.href, '/reports')

console.log('ai-chat-bar-test: PASS (global layout mount, prompt message, quick actions, keyboard shortcut, API security, and intent routing verified)')
