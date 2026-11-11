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
assert.match(route, /workspaceError: error|error: workspaceError/)
assert.equal((route.match(/Active workspace could not be verified/g) ?? []).length, 2, 'GET and PUT must distinguish workspace lookup failures from a missing workspace')
assert.ok(route.includes("supabase.rpc('is_workspace_admin'"), 'profile API must verify workspace admin')
assert.match(route, /if \(roleError\) return NextResponse\.json\(\{ error: 'Workspace authorization could not be verified\.' \}, \{ status: 503 \}\)/, 'GET must fail closed when workspace authorization cannot be verified')
assert.ok(route.indexOf('if (roleError)') < route.indexOf(".from('workspace_onboarding_profiles')"), 'GET must not read onboarding data until admin status is confirmed')
assert.ok(route.includes('canEdit: isAdmin === true'), 'only a successful admin check may set canEdit')
assert.ok(route.includes("'profile', 'status'"), 'profile API must reject unknown request properties')
assert.ok(route.includes('validateOnboardingProfile'), 'profile API must validate profile payloads')
assert.ok(route.includes('updated_by: user.id'), 'profile writes must be attributed to the signed-in user')
assert.ok(route.includes("status === 'completed' && (!validated.profile.companyType || validated.profile.companyType === 'unsure' || !validated.profile.primaryGoal?.trim())"), 'completion must include an explicit business type and a non-empty first goal')
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
assert.ok(migrationV2.includes('workspace_onboarding_profiles_completed_profile_check'), 'v2 migration must prevent incomplete profiles from being marked complete')
assert.ok(migrationV2.includes('workspace_onboarding_profile_events'), 'v2 migration must create an append-only onboarding audit table')
assert.ok(migrationV2.includes('record_workspace_onboarding_profile_event'), 'v2 migration must audit accepted profile saves')
assert.ok(migrationV2.includes('guard_workspace_onboarding_profile_event_insert'), 'audit rows must be guarded against direct client inserts')
assert.ok(migrationV2.includes('pg_trigger_depth() <> 2'), 'only the direct nested profile audit trigger may create audit rows')
assert.ok(migrationV2.includes("source = 'owner_confirmed_onboarding_form'"), 'audit events must record their reviewed source')
assert.ok(migrationV2.includes("confidence = 'owner_confirmed'"), 'audit events must record owner-confirmed confidence')
assert.ok(migrationV2.includes('unknown_fields'), 'audit events must preserve explicit unknown field markers')
assert.ok(migrationV2.includes('security invoker'), 'audit trigger must not elevate privileges')
assert.ok(migrationV2.includes('create policy workspace_onboarding_profile_events_select'), 'audit history must be admin-readable only')
assert.ok(migrationV2.includes('actor_id = auth.uid()'), 'audit inserts must be attributed to the signed-in actor')
assert.ok(migrationV2.includes('enable row level security'), 'audit history must have RLS enabled')
assert.ok(migrationV2.includes('revoke all on public.workspace_onboarding_profile_events from public, anon, authenticated'), 'audit table must have explicit grants')
assert.ok(migrationV2.includes("set status = 'draft'"), 'v2 migration must correct legacy incomplete completion states')
assert.ok(migrationV2.includes('completed_at = null'), 'v2 migration must clear the completion timestamp when correcting a legacy draft')
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

const postgresRunner = readFileSync(new URL('../scripts/ci/verify-onboarding-profile-postgres.sh', import.meta.url), 'utf8')
assert.match(postgresRunner, /DB="roofos_onboarding_ci_\$\{GITHUB_RUN_ID:-local\}_\$\{GITHUB_RUN_ATTEMPT:-1\}_\$\$"/)
assert.match(postgresRunner, /trap cleanup EXIT/)
assert.match(postgresRunner, /drop database if exists/)
assert.match(postgresRunner, /if \[\[ -n "\$\{GITHUB_STEP_SUMMARY:-\}" \]\]/)

// Keep the TypeScript validator and database constraints in lockstep.
const profileSource = readFileSync(new URL('../lib/onboarding-profile.ts', import.meta.url), 'utf8')
const allowedFieldsBlock = profileSource.match(/const allowed = new Set\(\[([\s\S]*?)\]\)/)?.[1]
const sqlAllowedFieldsBlock = migrationV2.match(/add constraint workspace_onboarding_profiles_allowed_fields_v2_check\s+check \(profile - ARRAY\[([\s\S]*?)\]::text\[\]/)?.[1]
assert.ok(allowedFieldsBlock && sqlAllowedFieldsBlock, 'profile field allowlists must be discoverable')
const parseQuotedValues = (value) => [...value.matchAll(/'([^']+)'/g)].map((match) => match[1])
assert.deepEqual(
  parseQuotedValues(sqlAllowedFieldsBlock).sort(),
  parseQuotedValues(allowedFieldsBlock).sort(),
  'TypeScript and SQL profile field allowlists must match exactly',
)

const enumValuesBlock = profileSource.match(/const enumValues = \{([\s\S]*?)\n\} as const/)?.[1]
assert.ok(enumValuesBlock, 'TypeScript profile enum definitions must be discoverable')
for (const match of enumValuesBlock.matchAll(/(\w+): \[([^\]]+)\]/g)) {
  const [, key, rawValues] = match
  const expected = parseQuotedValues(rawValues).sort()
  const sqlLists = [...migrationV2.matchAll(new RegExp(`profile->>'${key}' in \\(([^)]*)\\)`, 'g'))]
    .map((entry) => parseQuotedValues(entry[1]).sort())
  assert.ok(
    sqlLists.some((values) => values.length === expected.length && values.every((value, index) => value === expected[index])),
    `TypeScript and SQL enum values must match for ${key}`,
  )
}

const arrayValuesBlock = profileSource.match(/const arrayAllowedValues = \{([\s\S]*?)\n\} as const/)?.[1]
assert.ok(arrayValuesBlock, 'TypeScript array enum definitions must be discoverable')
for (const match of arrayValuesBlock.matchAll(/(\w+): \[([^\]]+)\]/g)) {
  const [, key, rawValues] = match
  const expected = parseQuotedValues(rawValues).sort()
  const triggerIndex = migrationV2.indexOf(`profile->'${key}'`)
  const sqlSection = triggerIndex >= 0 ? migrationV2.slice(triggerIndex, triggerIndex + 700) : ''
  const sqlValues = sqlSection.match(/ARRAY\[([^\]]+)\]::text\[\]/)?.[1]
  assert.ok(sqlValues, `SQL must constrain the allowed values for ${key}`)
  const actual = parseQuotedValues(sqlValues).sort()
  assert.deepEqual(actual, expected, `TypeScript and SQL array values must match for ${key}`)
}

console.log('onboarding-profile-test: PASS')
