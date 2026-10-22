import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const catalog = readFileSync(new URL('../lib/pricing/owner-labor.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/pricing-config/page.tsx', import.meta.url), 'utf8')
const route = readFileSync(new URL('../app/api/pricing/labor-rates/route.ts', import.meta.url), 'utf8')

const keys = [...catalog.matchAll(/key: '([^']+)'/g)].map((match) => match[1])
assert.equal(keys.length, 45, `owner labor catalog must be 3x the original 15 services, got ${keys.length}`)
assert.equal(new Set(keys).size, 45, 'labor service keys must be unique')
for (const original of ['roofing', 'siding', 'windows', 'doors', 'gutters', 'decking', 'drywall', 'painting', 'electrical', 'plumbing', 'hvac', 'demo', 'cleanup', 'inspection', 'consulting']) {
  assert.ok(keys.includes(original), `original service missing: ${original}`)
}
assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(catalog), 'labor catalog must not use emoji icons')
assert.ok(page.includes('OWNER_LABOR_SERVICES'), 'pricing config must render the shared labor catalog')
assert.ok(page.includes("from 'lucide-react'"), 'labor cards must use Lucide stroke icons')
assert.ok(page.includes('strokeWidth={1.75}'), 'labor icons must render as thin modern strokes')
assert.ok(route.includes('DEFAULT_OWNER_LABOR_RATES'), 'labor-rates API must use the shared catalog')
assert.ok(route.includes('ownerLaborUnitCode'), 'saved price-book units must come from the catalog')
console.log('owner-labor-catalog-test: PASS (45 services, originals kept, page and API share the catalog)')
