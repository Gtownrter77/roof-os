import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/086_two_hour_trial_activation.sql')
const expiry = read('../supabase/migrations/085_workspace_trial_expiry.sql')
const signup = read('../app/auth/signup/page.tsx')
const callback = read('../app/auth/callback/route.ts')
const activationPage = read('../app/trial/activate/page.tsx')
const activationRoute = read('../app/api/trials/activate/route.ts')

assert.ok(migration.includes('company_domain text primary key'), 'one claim per company domain')
assert.ok(migration.includes('user_id uuid not null unique'), 'one trial claim per user')
assert.ok(migration.includes('workspace_id uuid not null unique'), 'one trial claim per workspace')
assert.ok(migration.includes('v_email_domain <> v_domain'), 'verified email domain must match company domain')
assert.ok(migration.includes('email_confirmed_at'), 'database verifies the email confirmation state')
assert.ok(migration.includes("interval '2 hours'"), 'trial duration is exactly two hours')
assert.ok(migration.includes('for update of w'), 'workspace activation is serialized')
assert.ok(migration.includes('when unique_violation'), 'duplicate company/account claims are rejected')
assert.ok(migration.includes('revoke all on function public.activate_two_hour_workspace_trial(text) from public, anon'))
assert.ok(migration.includes('grant execute on function public.activate_two_hour_workspace_trial(text) to authenticated'))
assert.ok(migration.includes('alter table public.workspace_trial_claims enable row level security'))
assert.ok(!migration.includes('create policy') && !migration.includes('grant select on public.workspace_trial_claims'), 'trial claims are not directly readable by clients')

assert.ok(expiry.includes('workspace.trial_expires_at > statement_timestamp()'), 'expired access is rejected by the database')
assert.ok(signup.includes('request_two_hour_trial: true'), 'new trial signups are explicitly marked')
assert.ok(signup.includes('trial_company_domain: companyDomain.trim().toLowerCase()'))
assert.ok(callback.includes("new URL('/trial/activate', url.origin)"), 'verified trial signup is sent to activation')
assert.ok(callback.includes("user?.user_metadata?.request_two_hour_trial === true"))

assert.ok(activationRoute.includes("supabase.auth.getUser()"), 'activation endpoint requires an authenticated user')
assert.ok(activationRoute.includes("supabase.rpc('activate_two_hour_workspace_trial'"), 'activation calls the database authority')
assert.ok(activationRoute.includes("key !== 'companyDomain'"), 'activation rejects unexpected request fields')
assert.ok(!activationRoute.includes('createAdminClient') && !activationRoute.includes('SUPABASE_SERVICE_ROLE_KEY'), 'activation does not use a service-role bypass')
assert.ok(activationPage.includes("fetch('/api/trials/activate'"), 'activation UI calls the protected endpoint')
assert.ok(activationPage.includes('Start my 2-hour trial'))
assert.ok(activationPage.includes('press Activate'))

console.log('two-hour-trial-activation-contract-test: PASS (verified company domain, atomic one-per-company/user/workspace claim, two-hour server expiry, authenticated activation)')
