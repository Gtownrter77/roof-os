import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BAILEY_AGENT_CATALOG, BAILEY_AGENT_SETUP_VERSION,
  defaultBaileyAgentSetup, validateBaileyAgentSetup,
} from '../lib/bailey-agent-onboarding.ts'

assert.equal(BAILEY_AGENT_SETUP_VERSION, 1)
assert.equal(BAILEY_AGENT_CATALOG.length, 15)
assert.equal(new Set(BAILEY_AGENT_CATALOG.map(({ key }) => key)).size, 15)

const safeDefaults = defaultBaileyAgentSetup()
assert.equal(Object.keys(safeDefaults).length, 15)
assert.ok(Object.values(safeDefaults).every((mode) => mode === 'off'))
assert.deepEqual(validateBaileyAgentSetup(safeDefaults).setup, safeDefaults)
assert.equal(validateBaileyAgentSetup({}).setup, undefined)
assert.equal(validateBaileyAgentSetup(null).setup, undefined)
assert.equal(validateBaileyAgentSetup({ ...safeDefaults, unexpected: 'off' }).setup, undefined)
assert.equal(validateBaileyAgentSetup({ ...safeDefaults, finance: 'execute' }).setup, undefined)
assert.equal(validateBaileyAgentSetup({ ...safeDefaults, finance: true }).setup, undefined)
assert.equal(validateBaileyAgentSetup({ ...safeDefaults, finance: 'approval_required' }).setup?.finance, 'approval_required')
const withoutKey = { ...safeDefaults }
delete withoutKey.research
assert.equal(validateBaileyAgentSetup(withoutKey).setup, undefined)

const file = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const api = file('app/api/onboarding/agents/route.ts')
const page = file('app/onboarding/agents/page.tsx')
const migration = file('supabase/migrations/094_workspace_bailey_agent_setup.sql')
const workspace = file('app/onboarding/workspace/page.tsx')
const navigation = file('lib/nav.ts')

assert.match(api, /supabase\.auth\.getUser\(\)/)
assert.match(api, /current_workspace_id/)
assert.match(api, /is_workspace_admin/)
assert.match(api, /validateBaileyAgentSetup\(fields\.setup\)/)
assert.match(api, /Object\.keys\(fields\)\.some/)
assert.match(api, /operational: false/)
assert.match(api, /readJson\(request\)/)
assert.match(page, /fetch\('\/api\/onboarding\/agents', \{ cache: 'no-store' \}\)/)
assert.match(page, /method: 'PUT'/)
assert.match(page, /reviewConfirmed/)
assert.match(page, /No agents were activated/)
assert.match(page, /only a requested future mode/)
assert.match(page, /loadFailed/)
assert.match(page, /!canEdit \|\| saving/)
assert.match(workspace, /href="\/onboarding\/agents"/)
assert.match(navigation, /href: '\/onboarding\/agents'/)
assert.match(migration, /enable row level security/)
assert.match(migration, /public\.is_workspace_admin\(workspace_id\)/)
assert.match(migration, /public\.is_workspace_member\(workspace_id\)/)
assert.match(migration, /auth\.uid\(\) = updated_by/)
assert.match(migration, /check \(public\.bailey_agent_setup_is_valid\(setup\)\)/)
assert.doesNotMatch(api, /agent_actions|executeAction|trigger_deploy|twilio/i)
console.log('BAILEY agent onboarding contract tests PASS')
