import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const crons = vercel.crons ?? []

assert.ok(crons.length > 0, 'vercel.json must define at least one cron job')
assert.ok(crons.length <= 2, `Vercel Hobby allows at most 2 cron jobs, found ${crons.length}`)

for (const cron of crons) {
  const routePath = `app${cron.path}/route.ts`
  assert.ok(existsSync(routePath), `cron path ${cron.path} has no route handler at ${routePath}`)
  const route = readFileSync(routePath, 'utf8')
  assert.ok(/export (async function GET|const GET\s*=)/.test(route), `cron path ${cron.path} must export GET (Vercel Cron uses GET)`)
}

const daily = crons.find((cron) => cron.path === '/api/cron/daily')
assert.ok(daily, 'vercel.json must schedule the consolidated daily dispatcher')
assert.equal(daily.schedule, '0 14 * * *', 'daily dispatcher must run at 14:00 UTC to stay inside quiet-hours logic')

const retailer = crons.find((cron) => cron.path === '/api/cron/retailer-prices')
assert.ok(retailer, 'vercel.json must keep the weekly retailer price refresh')
assert.equal(retailer.schedule, '0 4 * * 1', 'retailer refresh must stay weekly on Monday')

for (const job of ['inspection-quality', 'receptionist-followups', 'warranty-expiry']) {
  const route = readFileSync(`app/api/cron/${job}/route.ts`, 'utf8')
  assert.ok(/export (async function GET|const GET\s*=)/.test(route), `${job} must expose GET for manual and dispatcher runs`)
  assert.ok(!crons.some((cron) => cron.path === `/api/cron/${job}`), `${job} must run through the daily dispatcher, not its own Vercel cron`)
}

console.log('cron-http-contract-test: PASS')
