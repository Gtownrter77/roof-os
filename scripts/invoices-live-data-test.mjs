import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/invoices/page.tsx', import.meta.url), 'utf8')

assert.ok(page.includes("from('invoices')"))
assert.ok(page.includes("amount_cents"))
assert.ok(page.includes("invoice_number"))
assert.ok(page.includes("No invoices recorded"))
assert.ok(!page.includes('John Doe'))
assert.ok(!page.includes('INV-001'))
assert.ok(!page.includes("status: 'Paid'"))
assert.ok(!page.includes('setTimeout'))
assert.ok(!page.includes('New</button>'))
console.log('invoices-live-data-test: PASS')
