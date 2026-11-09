import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ONBOARDING_PROFILE_VERSION,
  validateOnboardingProfile,
} from '../lib/onboarding-profile.ts'

assert.equal(ONBOARDING_PROFILE_VERSION, 1)

const valid = validateOnboardingProfile({
  companyType: 'both',
  serviceZipCodes: ['30127', '30127', '30303'],
  roofingSystems: ['Architectural shingles', 'Standing seam metal'],
  relatedServices: ['Gutters'],
  crewCountBand: '6-10',
  leadSources: ['Referral', 'Website'],
  inspectionStyle: 'photo_first',
  estimateWorkflow: 'owner_priced',
  productionWorkflow: 'mixed',
  customerContactPreferences: ['phone', 'text', 'text'],
  primaryGoal: 'Make estimates and production handoff easier.',
})
assert.deepEqual(valid.error, undefined)
assert.deepEqual(valid.profile?.serviceZipCodes, ['30127', '30303'])
assert.deepEqual(valid.profile?.customerContactPreferences, ['phone', 'text'])

for (const invalid of [
  null,
  [],
  'not an object',
  { companyType: 'all' },
  { crewCountBand: '100+' },
  { inspectionStyle: 'AI does it all' },
  { estimateWorkflow: 'automatic pricing' },
  { productionWorkflow: 'YOLO' },
  { customerContactPreferences: ['fax'] },
  { customerContactPreferences: ['phone', 'email', 'text', 'unsure', 'extra'] },
  { serviceZipCodes: ['3012'] },
  { serviceZipCodes: Array.from({ length: 21 }, (_, i) => String(30000 + i)) },
  { roofingSystems: ['x'.repeat(81)] },
  { relatedServices: ['x'.repeat(81)] },
  { leadSources: ['x'.repeat(61)] },
  { primaryGoal: 'x'.repeat(241) },
  { ownerAuthorization: { email: 'owner@example.com', confirmation: 'AUTHORIZE SETTINGS' } },
  { yolo_mode: true },
  { arbitraryToolCall: { name: 'delete_workspace' } },
]) {
  assert.ok(validateOnboardingProfile(invalid).error, `expected invalid profile: ${JSON.stringify(invalid)}`)
}

assert.deepEqual(validateOnboardingProfile({ serviceZipCodes: [' 30127 ', ''] }).profile?.serviceZipCodes, ['30127'])
assert.deepEqual(validateOnboardingProfile({ primaryGoal: '  First priority  ' }).profile?.primaryGoal, 'First priority')

const route = readFileSync(new URL('../app/api/onboarding/profile/route.ts', import.meta.url), 'utf8')
assert.ok(route.includes("supabase.rpc('current_workspace_id')"), 'profile API must use the active workspace')
assert.ok(route.includes("supabase.rpc('is_workspace_admin'"), 'profile API must verify workspace admin')
assert.ok(route.includes("'profile', 'status'"), 'profile API must reject unknown request properties')
assert.ok(route.includes('validateOnboardingProfile'), 'profile API must validate profile payloads')
assert.ok(route.includes('updated_by: user.id'), 'profile writes must be attributed to the signed-in user')
assert.ok(route.includes("status === 'completed' && !validated.profile.companyType"), 'completion must include a reviewed business type or unsure selection')
assert.ok(!route.includes('service_role'), 'profile API must not use service-role credentials')
assert.ok(!route.includes('/api/settings'), 'profile API must not bypass operational settings authorization')

const migration = readFileSync(new URL('../supabase/migrations/092_workspace_onboarding_profiles.sql', import.meta.url), 'utf8')
assert.ok(migration.includes('public.is_workspace_member(workspace_id)'), 'workspace members may read their workspace profile')
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'), 'only workspace admins may write profile data')
assert.ok(migration.includes('auth.uid() = updated_by'), 'profile writes must be attributed to the current user')
assert.ok(migration.includes("status in ('draft', 'completed')"), 'profile status must be constrained')
assert.ok(migration.includes('jsonb_typeof(profile) = \'object\''), 'profile storage must be an object')
assert.ok(!migration.includes('security definer'), 'onboarding profile migration must not add a security-definer function')

console.log('onboarding-profile-test: PASS')
