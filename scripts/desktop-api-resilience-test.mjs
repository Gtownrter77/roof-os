import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readApiJson } from '../lib/client/safe-fetch.ts'

const fake = (ok, status, body, jsonThrows = false) => ({
  ok,
  status,
  json: async () => { if (jsonThrows) throw new SyntaxError('Unexpected token'); return body },
})

const good = await readApiJson(fake(true, 200, { status: 'ready', alerts: [] }))
assert.equal(good.ok, true)
assert.deepEqual(good.data, { status: 'ready', alerts: [] })
assert.equal(good.error, null)

const auth = await readApiJson(fake(false, 401, { error: 'Authentication required.' }))
assert.equal(auth.ok, false)
assert.equal(auth.error, 'Authentication required.')

const html = await readApiJson(fake(false, 502, null, true))
assert.equal(html.ok, false)
assert.match(html.error, /502/)

const damaged = await readApiJson(fake(true, 200, null, true))
assert.equal(damaged.ok, false)
assert.match(damaged.error, /unreadable/i)

// Every desktop call site must use the safe reader and surface server errors.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const weather = read('components/WorkspaceWeather.tsx')
const wizard = read('app/ai-wizard/page.tsx')
const switches = read('components/AgentSwitches.tsx')
const actions = read('app/api/agent-actions/route.ts')
const radar = read('components/WeatherRadarMap.tsx')

assert.match(weather, /readApiJson/)
assert.doesNotMatch(weather, /const payload = await response\.json\(\)/)
assert.match(wizard, /readApiJson/)
assert.match(wizard, /setHistory\(\(current\) => \[/)
assert.match(switches, /readApiJson/)
assert.match(switches, /no rule row/, 'unseeded agent rules must be explained')
assert.match(actions, /isUuid\(workspaceId\)/)

// Radar failures are confined to the map; weather figures remain independent.
assert.match(radar, /map\.on\('error'/)
assert.match(radar, /Weather figures are kept separate/)

console.log('desktop API resilience contract passed')
