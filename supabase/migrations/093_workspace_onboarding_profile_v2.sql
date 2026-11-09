-- Expand the workspace onboarding profile without changing operational settings.
-- Version 1 did not enforce a profile-field allowlist in SQL, so add the v2
-- allowlist directly while retaining the existing object-shape check.
begin;

-- Migration 092 installed a table-level v1 profile-key allowlist. PostgreSQL
-- ANDs CHECK constraints, so leaving that constraint in place would reject
-- every v2-only key even after the v2 allowlist below accepts it. Identify the
-- old constraint by its definition rather than relying on a generated name.
do $drop_v1_allowlist$
declare
  old_constraint name;
begin
  select conname
    into old_constraint
  from pg_constraint
  where conrelid = 'public.workspace_onboarding_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%profile - ARRAY%'
    and pg_get_constraintdef(oid) like '%yearsInBusinessBand%' = false
    and pg_get_constraintdef(oid) like '%primaryGoal%';

  if old_constraint is not null then
    execute format(
      'alter table public.workspace_onboarding_profiles drop constraint %I',
      old_constraint
    );
  end if;
end;
$drop_v1_allowlist$;

alter table public.workspace_onboarding_profiles
  drop constraint if exists workspace_onboarding_profiles_schema_version_check;

update public.workspace_onboarding_profiles
set schema_version = 2
where schema_version = 1;

alter table public.workspace_onboarding_profiles
  alter column schema_version set default 2,
  add constraint workspace_onboarding_profiles_schema_version_check check (schema_version = 2);

-- Pure validation helper: no table access, elevated privileges, or side effects.
create or replace function public.onboarding_jsonb_string_array_is_valid(
  value jsonb,
  max_items integer,
  max_chars integer,
  item_pattern text default null,
  allowed_values text[] default null
)
returns boolean
language sql
immutable
parallel safe
as $function$
  select case
    when value is null or jsonb_typeof(value) <> 'array' then false
    when jsonb_array_length(value) > max_items then false
    else not exists (
      select 1
      from jsonb_array_elements(value) as element(value)
      where jsonb_typeof(element.value) <> 'string'
        or length(element.value #>> '{}') > max_chars
        or (item_pattern is not null and (element.value #>> '{}') !~ item_pattern)
        or (
          allowed_values is not null
          and not ((element.value #>> '{}') = any(allowed_values))
        )
    )
  end;
$function$;

alter table public.workspace_onboarding_profiles
  add constraint workspace_onboarding_profiles_allowed_fields_v2_check
  check (profile - ARRAY[
    'companyType', 'yearsInBusinessBand', 'serviceZipCodes', 'roofingSystems',
    'relatedServices', 'crewCountBand', 'teamRoles', 'leadSources',
    'inspectionStyle', 'photoEvidenceWorkflow', 'estimateWorkflow',
    'approvalWorkflow', 'productionWorkflow', 'schedulingWorkflow',
    'materialWorkflow', 'permitWorkflow', 'qualityControlWorkflow',
    'closeoutWorkflow', 'warrantyWorkflow', 'customerContactPreferences',
    'businessHours', 'primaryGoal'
  ]::text[] = '{}'::jsonb),

  add constraint workspace_onboarding_profiles_company_type_check
  check (not (profile ? 'companyType') or coalesce(profile->>'companyType' in ('residential','commercial','both','unsure'), false)),

  add constraint workspace_onboarding_profiles_crew_count_check
  check (not (profile ? 'crewCountBand') or coalesce(profile->>'crewCountBand' in ('solo','2-5','6-10','11-25','26+','unsure'), false)),

  add constraint workspace_onboarding_profiles_inspection_style_check
  check (not (profile ? 'inspectionStyle') or coalesce(profile->>'inspectionStyle' in ('manual','photo_first','drone_assisted','mixed','unsure'), false)),

  add constraint workspace_onboarding_profiles_estimate_workflow_check
  check (not (profile ? 'estimateWorkflow') or coalesce(profile->>'estimateWorkflow' in ('owner_priced','estimator_priced','external','unsure'), false)),

  add constraint workspace_onboarding_profiles_production_workflow_check
  check (not (profile ? 'productionWorkflow') or coalesce(profile->>'productionWorkflow' in ('in_house','subcontracted','mixed','unsure'), false)),

  add constraint workspace_onboarding_profiles_years_in_business_check
  check (not (profile ? 'yearsInBusinessBand') or coalesce(profile->>'yearsInBusinessBand' in ('0-1','2-5','6-10','11-20','20+','unsure'), false)),

  add constraint workspace_onboarding_profiles_photo_evidence_workflow_check
  check (not (profile ? 'photoEvidenceWorkflow') or coalesce(profile->>'photoEvidenceWorkflow' in ('phone_photos','drone_photos','mixed','unsure'), false)),

  add constraint workspace_onboarding_profiles_approval_workflow_check
  check (not (profile ? 'approvalWorkflow') or coalesce(profile->>'approvalWorkflow' in ('owner_approval','manager_approval','external','unsure'), false)),

  add constraint workspace_onboarding_profiles_scheduling_workflow_check
  check (not (profile ? 'schedulingWorkflow') or coalesce(profile->>'schedulingWorkflow' in ('calendar','spreadsheet','software','manual','unsure'), false)),

  add constraint workspace_onboarding_profiles_material_workflow_check
  check (not (profile ? 'materialWorkflow') or coalesce(profile->>'materialWorkflow' in ('owner_ordered','crew_pickup','supplier_delivery','mixed','unsure'), false)),

  add constraint workspace_onboarding_profiles_permit_workflow_check
  check (not (profile ? 'permitWorkflow') or coalesce(profile->>'permitWorkflow' in ('in_house','subcontracted','not_applicable','unsure'), false)),

  add constraint workspace_onboarding_profiles_quality_control_workflow_check
  check (not (profile ? 'qualityControlWorkflow') or coalesce(profile->>'qualityControlWorkflow' in ('checklist','manager_walkthrough','photo_review','mixed','unsure'), false)),

  add constraint workspace_onboarding_profiles_closeout_workflow_check
  check (not (profile ? 'closeoutWorkflow') or coalesce(profile->>'closeoutWorkflow' in ('owner_review','office_review','mixed','unsure'), false)),

  add constraint workspace_onboarding_profiles_warranty_workflow_check
  check (not (profile ? 'warrantyWorkflow') or coalesce(profile->>'warrantyWorkflow' in ('manufacturer','company','both','unsure'), false)),

  add constraint workspace_onboarding_profiles_service_zip_codes_check
  check (
    not (profile ? 'serviceZipCodes')
    or public.onboarding_jsonb_string_array_is_valid(profile->'serviceZipCodes', 20, 5, '^[0-9]{5}$')
  ),

  add constraint workspace_onboarding_profiles_roofing_systems_check
  check (
    not (profile ? 'roofingSystems')
    or public.onboarding_jsonb_string_array_is_valid(profile->'roofingSystems', 12, 80)
  ),

  add constraint workspace_onboarding_profiles_related_services_check
  check (
    not (profile ? 'relatedServices')
    or public.onboarding_jsonb_string_array_is_valid(profile->'relatedServices', 12, 80)
  ),

  add constraint workspace_onboarding_profiles_lead_sources_check
  check (
    not (profile ? 'leadSources')
    or public.onboarding_jsonb_string_array_is_valid(profile->'leadSources', 12, 60)
  ),

  add constraint workspace_onboarding_profiles_team_roles_check
  check (
    not (profile ? 'teamRoles')
    or public.onboarding_jsonb_string_array_is_valid(
      profile->'teamRoles',
      10,
      32,
      null,
      ARRAY['owner','manager','sales','estimator','project_manager','inspector','foreman','installer','office','other']::text[]
    )
  ),

  add constraint workspace_onboarding_profiles_contact_preferences_check
  check (
    not (profile ? 'customerContactPreferences')
    or public.onboarding_jsonb_string_array_is_valid(
      profile->'customerContactPreferences',
      4,
      16,
      null,
      ARRAY['phone','email','text','unsure']::text[]
    )
  ),

  add constraint workspace_onboarding_profiles_business_hours_check
  check (
    not (profile ? 'businessHours')
    or (jsonb_typeof(profile->'businessHours') = 'string' and length(profile->>'businessHours') <= 80)
  ),

  add constraint workspace_onboarding_profiles_primary_goal_check
  check (
    not (profile ? 'primaryGoal')
    or (jsonb_typeof(profile->'primaryGoal') = 'string' and length(profile->>'primaryGoal') <= 240)
  );

comment on column public.workspace_onboarding_profiles.schema_version is
  'Version 2 adds reviewed team-role, evidence, approval, scheduling, material, permit, quality, closeout, warranty, and communication preferences.';

commit;
