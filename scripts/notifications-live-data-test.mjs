import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const page = readFileSync(new URL('../app/notifications/page.tsx', import.meta.url), 'utf8')
assert.ok(page.includes("from('lead_activity')"))
assert.ok(page.includes('No demo alerts'))
assert.ok(!page.includes('SLA Breach'))
assert.ok(!page.includes('John Doe'))
assert.ok(!page.includes('Sarah Wilson'))
console.log('notifications-live-data-test: PASS')
