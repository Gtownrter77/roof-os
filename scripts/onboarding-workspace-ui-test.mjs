import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/onboarding/workspace/page.tsx', import.meta.url), 'utf8')
const accountBasicsPage = readFileSync(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../app/api/onboarding/profile/route.ts', import.meta.url), 'utf8')
const validator = readFileSync(new URL('../lib/onboarding-profile.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/092_workspace_onboarding_profiles.sql', import.meta.url), 'utf8')

// The screen must load only the active authenticated workspace profile and avoid caching it.
assert.match(page, /fetch\('\/api\/onboarding\/profile', \{ cache: 'no-store' \}\)/)
assert.match(page, /setCanEdit\(data\.canEdit === true\)/)
assert.match(page, /disabled=\{!canEdit\}/)
assert.match(page, /You can review this workspace profile, but only a workspace administrator can change it\./)

// Saving and completion are explicit user actions; navigation alone must not write.
assert.match(page, /onClick=\{\(\) => void save\('draft'\)\}/)
assert.match(page, /onClick=\{\(\) => void save\('completed'\)\}/)
assert.match(page, /setStep\(\(current\) => Math\.min\(STEPS\.length - 1, current \+ 1\)\)/)
assert.doesNotMatch(page, /useEffect\([\s\S]{0,500}save\('completed'\)/)

// The UI must expose all five setup sections and explain the non-operational boundary.
for (const step of ['Business', 'Service area', 'Work mix', 'Workflow', 'Goal']) {
  assert.ok(page.includes(step), `missing onboarding section: ${step}`)
}
assert.match(page, /does not change pricing, permissions, crew assignments, customer records, integrations, or live operations/)
assert.match(page, /AI recommendations are not connected in this phase/)

// API writes require an authenticated workspace administrator and strict field allowlisting.
assert.match(api, /Authentication required/)
assert.match(api, /is_workspace_admin/)
assert.match(api, /Workspace administrator access is required/)
assert.match(api, /validateOnboardingProfile\(body\.profile\)/)
assert.match(api, /Object\.keys\(body\)\.some\(\(key\) => !\['profile', 'status'\]\.includes\(key\)\)/)
assert.match(api, /current_workspace_id/)
assert.match(validator, /Profile contains an unsupported field/)
assert.match(validator, /Service ZIP codes must contain five digits/)
assert.match(validator, /240 characters or fewer/)

// Persistence remains workspace-scoped with member-read/admin-write RLS.
assert.match(migration, /enable row level security/i)
assert.match(migration, /public\.is_workspace_member\(workspace_id\)/)
assert.match(migration, /public\.is_workspace_admin\(workspace_id\)/)
assert.match(migration, /auth\.uid\(\) = updated_by/)

// The legacy account form saves only account basics and hands off to workspace setup.
assert.match(accountBasicsPage, /onboarding_basics_saved_at/)
assert.doesNotMatch(accountBasicsPage, /onboarding_completed_at/)
assert.match(accountBasicsPage, /router\.push\('\/onboarding\/workspace'\)/)
assert.match(accountBasicsPage, /Account basics saved/)
assert.match(accountBasicsPage, /workspace setup is next/i)

console.log('Workspace onboarding UI contract tests passed.')
