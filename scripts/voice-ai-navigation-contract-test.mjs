import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/voice-ai/page.tsx', 'utf8')
const copilot = readFileSync('lib/ai/chat-copilot.ts', 'utf8')
const check = (pattern, label) => assert.ok(pattern.test(page), label)

// /api/ai/chat spreads processChatCopilot(), which returns suggestedAction.href
// and never action.url. The old handler acknowledged spoken navigation but
// never actually navigated.
check(/data\.navigate === true \? data\.suggestedAction\?\.href/, 'voice page must only navigate on an explicit navigation intent')
check(/startsWith\('\/'\)/, 'voice page must only navigate to internal paths')
assert.ok(!/data\.action\?\.type/.test(page), 'voice page must not read the nonexistent action.type field')
assert.match(copilot, /navigate: true/, 'copilot must mark explicit navigation intents')
assert.match(copilot, /navigate: false/, 'copilot must not mark fallback replies as navigation')
console.log('voice-ai-navigation-contract-test: PASS (spoken navigation follows suggestedAction.href, internal paths only)')
