import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const predict = readFileSync('app/predict/page.tsx', 'utf8')
const plans = readFileSync('app/plans/page.tsx', 'utf8')
const wizard = readFileSync('app/ai-wizard/page.tsx', 'utf8')
const chat = readFileSync('app/chat/page.tsx', 'utf8')
const doors = readFileSync('app/doors-windows/page.tsx', 'utf8')
const notes = readFileSync('app/notifications/page.tsx', 'utf8')

assert.ok(!predict.includes('riskScore'), 'predict must not invent a risk score')
assert.ok(!predict.includes('setTimeout'), 'predict must not fake a delay')
assert.ok(predict.includes('/api/weather/summary'), 'predict must use the live weather check')
assert.ok(!plans.includes("price: '29'"), 'plans must not publish a starter price')
assert.ok(!plans.includes('14-day free trial'), 'plans must not promise a trial')
assert.ok(!wizard.includes('$8,000'), 'wizard must not quote a roof price')
assert.ok(!wizard.includes('confidence: 65'), 'wizard must not invent confidence')
assert.ok(wizard.includes('/api/ai/chat'), 'wizard must use the local assistant')
assert.ok(chat.includes('/api/ai/chat'), 'chat must use the local assistant')
assert.ok(doors.includes("return 'Unknown'"), 'door and window prices stay Unknown')
assert.ok(notes.includes(".from('tasks')"), 'notifications must read open tasks')
assert.ok(!predict.includes('api.x.ai') && !wizard.includes('XAI_API_KEY'), 'no hosted chat key')
console.log('stale-screens-test: PASS')
