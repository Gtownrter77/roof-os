import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/status/page.tsx', import.meta.url), 'utf8')
const route = readFileSync(new URL('../app/api/status/route.ts', import.meta.url), 'utf8')

assert.ok(page.includes("fetch('/api/status'"))
assert.ok(page.includes("uptime === 'not_measured'"))
assert.ok(!page.includes("setTimeout"))
assert.ok(!page.includes("'99.9%'"))
assert.ok(!page.includes("database: 'online'"))
assert.ok(route.includes("createAdminClient()"))
assert.ok(route.includes("from('workspaces')"))
assert.ok(route.includes("from('inspection-photos')"))
assert.ok(route.includes('api.weather.gov'))
assert.ok(route.includes("uptime: 'not_measured'"))
assert.ok(route.includes("cache-control"))
assert.ok(route.includes('XAI_API_KEY'))
assert.ok(route.includes('visionConfigured'))
assert.ok(route.includes('cronConfigured'))
const release = readFileSync(new URL('../scripts/release-check.mjs', import.meta.url), 'utf8')
assert.ok(release.includes('isPublicStatusRoute'))
assert.ok(release.includes('boundedStatusHealthFetch'))
console.log('status-health-check-test: PASS')
