-- Expand the workspace onboarding profile without changing operational settings.
-- Existing reviewed answers remain intact; the schema version advances in place.
begin;

alter table public.workspace_onboarding_profiles
  drop constraint if exists workspace_onboarding_profiles_schema_version_check;

update public.workspace_onboarding_profiles
set schema_version = 2
where schema_version = 1;

alter table public.workspace_onboarding_profiles
  alter column schema_version set default 2,
  add constraint workspace_onboarding_profiles_schema_version_check check (schema_version = 2);

-- Migration 092 created this allowlist check without an explicit name. Locate it
-- by its definition so the v2 allowlist can replace it without guessing a suffix.
do $migration$
declare
  allowlist_constraint text;
begin
  select conname
    into allowlist_constraint
  from pg_constraint
  where conrelid = 'public.workspace_onboarding_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%profile - ARRAY%'
  limit 1;

  if allowlist_constraint is null then
    raise exception 'Could not locate the v1 onboarding profile allowlist constraint';
  end if;

  execute format(
    'alter table public.workspace_onboarding_profiles drop constraint %I',
    allowlist_constraint
  );
end;
$migration$;

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

  add constraint workspace_onboarding_profiles_business_hours_check
  check (
    not (profile ? 'businessHours')
    or (jsonb_typeof(profile->'businessHours') = 'string' and length(profile->>'businessHours') <= 80)
  );

comment on column public.workspace_onboarding_profiles.schema_version is
  'Version 2 adds reviewed team-role, evidence, approval, scheduling, material, permit, quality, closeout, warranty, and communication preferences.';

commit;
