import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ONBOARDING_PROFILE_VERSION,
  validateOnboardingProfile,
} from '../lib/onboarding-profile.ts'

assert.equal(ONBOARDING_PROFILE_VERSION, 2)

const valid = validateOnboardingProfile({
  companyType: 'both',
  yearsInBusinessBand: '6-10',
  serviceZipCodes: ['30127', '30127', '30303'],
  roofingSystems: ['Architectural shingles', 'Standing seam metal'],
  relatedServices: ['Gutters'],
  crewCountBand: '6-10',
  teamRoles: ['owner', 'estimator', 'foreman'],
  leadSources: ['Referral', 'Website'],
  inspectionStyle: 'photo_first',
  photoEvidenceWorkflow: 'mixed',
  estimateWorkflow: 'owner_priced',
  approvalWorkflow: 'owner_approval',
  productionWorkflow: 'mixed',
  schedulingWorkflow: 'calendar',
  materialWorkflow: 'supplier_delivery',
  permitWorkflow: 'in_house',
  qualityControlWorkflow: 'photo_review',
  closeoutWorkflow: 'owner_review',
  warrantyWorkflow: 'both',
  customerContactPreferences: ['phone', 'text', 'text'],
  businessHours: 'Monday-Friday, 8 AM-5 PM',
  primaryGoal: 'Make estimates and production handoff easier.',
})
assert.deepEqual(valid.error, undefined)
assert.deepEqual(valid.profile?.serviceZipCodes, ['30127', '30303'])
assert.deepEqual(valid.profile?.customerContactPreferences, ['phone', 'text'])
assert.deepEqual(valid.profile?.teamRoles, ['owner', 'estimator', 'foreman'])
assert.equal(valid.profile?.businessHours, 'Monday-Friday, 8 AM-5 PM')

for (const invalid of [
  null,
  [],
  'not an object',
  { companyType: 'all' },
  { yearsInBusinessBand: '40 years' },
  { teamRoles: ['wizard'] },
  { photoEvidenceWorkflow: 'AI sees everything' },
  { approvalWorkflow: 'automatic' },
  { schedulingWorkflow: 'YOLO' },
  { materialWorkflow: 'magic' },
  { permitWorkflow: 'always approved' },
  { qualityControlWorkflow: 'trust me' },
  { closeoutWorkflow: 'auto-close' },
  { warrantyWorkflow: 'guaranteed' },
  { businessHours: 'x'.repeat(81) },
  { crewCountBand: '100+' },
  { inspectionStyle: 'AI does it all' },
  { estimateWorkflow: 'automatic pricing' },
  { productionWorkflow: 'YOLO' },
  { customerContactPreferences: ['fax'] },
  { customerContactPreferences: ['phone', 'email', 'text', 'unsure', 'extra'] },
  { serviceZipCodes: ['3012'] },
  { serviceZipCodes: ['30127x'] },
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
assert.ok(route.includes("status === 'completed' && (!validated.profile.companyType || !validated.profile.primaryGoal?.trim())"), 'completion must include a business type and a non-empty first goal')
assert.ok(!route.includes('service_role'), 'profile API must not use service-role credentials')
assert.ok(!route.includes('/api/settings'), 'profile API must not bypass operational settings authorization')

const migration = readFileSync(new URL('../supabase/migrations/092_workspace_onboarding_profiles.sql', import.meta.url), 'utf8')
const migrationV2 = readFileSync(new URL('../supabase/migrations/093_workspace_onboarding_profile_v2.sql', import.meta.url), 'utf8')
assert.ok(migration.includes('public.is_workspace_member(workspace_id)'), 'workspace members may read their workspace profile')
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'), 'only workspace admins may write profile data')
assert.ok(migration.includes('auth.uid() = updated_by'), 'profile writes must be attributed to the current user')
assert.ok(migration.includes("status in ('draft', 'completed')"), 'profile status must be constrained')
assert.ok(migration.includes("(status = 'draft' and completed_at is null)"), 'draft profiles must not retain a completion timestamp')
assert.ok(migration.includes('jsonb_typeof(profile) = \'object\''), 'profile storage must be an object')
assert.ok(!migration.includes('security definer'), 'onboarding profile migration must not add a security-definer function')

assert.ok(migrationV2.includes('schema_version = 2'), 'v2 migration must advance the profile schema')
assert.ok(migrationV2.includes('workspace_onboarding_profiles_allowed_fields_v2_check'), 'v2 migration must add the field allowlist')
assert.ok(migrationV2.includes('teamRoles'), 'v2 migration must constrain team roles')
assert.ok(migrationV2.includes('businessHours'), 'v2 migration must constrain business hours')
assert.ok(migrationV2.includes('create or replace function public.onboarding_jsonb_string_array_is_valid'), 'v2 migration must define its array validator')
assert.ok(migrationV2.includes('immutable'), 'the SQL array validator must be immutable')
assert.ok(migrationV2.includes('workspace_onboarding_profiles_service_zip_codes_check'), 'v2 migration must constrain service ZIP codes')
for (const constraint of [
  'workspace_onboarding_profiles_company_type_check',
  'workspace_onboarding_profiles_crew_count_check',
  'workspace_onboarding_profiles_inspection_style_check',
  'workspace_onboarding_profiles_estimate_workflow_check',
  'workspace_onboarding_profiles_production_workflow_check',
  'workspace_onboarding_profiles_team_roles_check',
  'workspace_onboarding_profiles_contact_preferences_check',
]) {
  assert.ok(migrationV2.includes(constraint), `v2 migration must add ${constraint}`)
}
assert.ok(!migrationV2.includes('security definer'), 'the SQL array validator must not use elevated privileges')

console.log('onboarding-profile-test: PASS')
