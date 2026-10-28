import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/api/ai/chat/route.ts', 'utf8')
const denial = source.indexOf("if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })")
const processing = source.indexOf('processChatCopilot({')
assert.ok(denial > -1, 'Unauthenticated AI chat requests must receive HTTP 401')
assert.ok(processing > denial, 'Auth denial must happen before the model is invoked')
console.log('ai-chat-auth-contract: PASS')
