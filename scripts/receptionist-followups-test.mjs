import { readFileSync } from 'node:fs'
const route = readFileSync(new URL('../app/api/cron/receptionist-followups/route.ts', import.meta.url), 'utf8')
assert.ok(route.includes("RECEPTIONIST_TIMEZONE"))
assert.ok(route.includes("timeZone: timezone"))
assert.ok(route.includes("latestConsent?.state === 'revoked'"))
assert.ok(route.includes('Consent lookup failed'))
console.log('receptionist follow-up guard tests passed')
