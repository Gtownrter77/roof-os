-- Expand the workspace onboarding profile without changing operational settings.
-- Version 1 did not enforce a profile-field allowlist in SQL, so add the v2
-- allowlist directly while retaining the existing object-shape check.
begin;

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
  p_value jsonb,
  p_max_items integer,
  p_max_length integer,
  p_pattern text default null,
  p_allowed_values text[] default null
)
returns boolean
language sql
immutable
parallel safe
as $function$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then false
    when jsonb_array_length(p_value) > p_max_items then false
    else not exists (
      select 1
      from jsonb_array_elements(p_value) as element(value)
      where jsonb_typeof(element.value) <> 'string'
        or length(element.value #>> '{}') > p_max_length
        or (p_pattern is not null and (element.value #>> '{}') !~ p_pattern)
        or (
          p_allowed_values is not null
          and not ((element.value #>> '{}') = any(p_allowed_values))
        )
    )
  end;
$function$;

-- Reclassify any legacy "completed" row that does not meet the explicit completion rule.
-- The profile answers are preserved; only the inaccurate completion state is corrected.
update public.workspace_onboarding_profiles
set status = 'draft',
    completed_at = null,
    updated_at = now()
where status = 'completed'
  and (
    not coalesce(profile->>'companyType' in ('residential', 'commercial', 'both'), false)
    or nullif(btrim(profile->>'primaryGoal'), '') is null
  );

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
  ),

  -- Completion must be meaningful even for direct authenticated Data API writes.
  add constraint workspace_onboarding_profiles_completed_profile_check
  check (
    status <> 'completed'
    or (
      coalesce(profile->>'companyType' in ('residential', 'commercial', 'both'), false)
      and nullif(btrim(profile->>'primaryGoal'), '') is not null
    )
  );

-- Append-only audit metadata for owner-confirmed profile saves. Store changed field names,
-- provenance, confidence, and explicit unknowns; never persist chat transcripts or values here.
create table if not exists public.workspace_onboarding_profile_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('draft_saved', 'completed', 'drafted', 'updated')),
  source text not null check (source = 'owner_confirmed_onboarding_form'),
  confidence text not null check (confidence = 'owner_confirmed'),
  changed_fields text[] not null default '{}'::text[],
  unknown_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.workspace_onboarding_profile_events enable row level security;

drop policy if exists workspace_onboarding_profile_events_select on public.workspace_onboarding_profile_events;
drop policy if exists workspace_onboarding_profile_events_insert on public.workspace_onboarding_profile_events;

create policy workspace_onboarding_profile_events_select
  on public.workspace_onboarding_profile_events for select
  to authenticated
  using (public.is_workspace_admin(workspace_id));

create policy workspace_onboarding_profile_events_insert
  on public.workspace_onboarding_profile_events for insert
  to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and actor_id = auth.uid()
  );

revoke all on public.workspace_onboarding_profile_events from public, anon, authenticated;
grant select, insert on public.workspace_onboarding_profile_events to authenticated;

create or replace function public.record_workspace_onboarding_profile_event()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_changed_fields text[] := array[]::text[];
  v_unknown_fields text[] := array[]::text[];
  v_actor uuid;
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    select coalesce(array_agg(item.key order by item.key), array[]::text[])
      into v_changed_fields
    from jsonb_object_keys(coalesce(new.profile, '{}'::jsonb)) as item(key);
  else
    select coalesce(array_agg(fields.key order by fields.key), array[]::text[])
      into v_changed_fields
    from (
      select key from jsonb_object_keys(coalesce(new.profile, '{}'::jsonb)) as new_fields(key)
      union
      select key from jsonb_object_keys(coalesce(old.profile, '{}'::jsonb)) as old_fields(key)
    ) as fields
    where old.profile -> fields.key is distinct from new.profile -> fields.key;

    if old.status is distinct from new.status then
      v_changed_fields := array_append(v_changed_fields, 'status');
    end if;
  end if;

  select coalesce(array_agg(field.key order by field.key), array[]::text[])
    into v_unknown_fields
  from jsonb_each(coalesce(new.profile, '{}'::jsonb)) as field(key, value)
  where field.value = '"unsure"'::jsonb
     or (jsonb_typeof(field.value) = 'array' and field.value @> '["unsure"]'::jsonb);

  if tg_op = 'INSERT' then
    v_event_type := case when new.status = 'completed' then 'completed' else 'draft_saved' end;
  elsif old.status is distinct from new.status and new.status = 'completed' then
    v_event_type := 'completed';
  elsif old.status is distinct from new.status and new.status = 'draft' then
    v_event_type := 'drafted';
  else
    v_event_type := 'updated';
  end if;

  v_actor := coalesce(auth.uid(), new.updated_by);
  if v_actor is null then
    raise exception 'Workspace onboarding profile audit actor is required';
  end if;

  if cardinality(v_changed_fields) > 0 then
    insert into public.workspace_onboarding_profile_events (
      workspace_id, actor_id, event_type, source, confidence, changed_fields, unknown_fields
    ) values (
      new.workspace_id, v_actor, v_event_type,
      'owner_confirmed_onboarding_form', 'owner_confirmed',
      v_changed_fields, v_unknown_fields
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.record_workspace_onboarding_profile_event() from public, anon;
grant execute on function public.record_workspace_onboarding_profile_event() to authenticated;

drop trigger if exists workspace_onboarding_profile_audit on public.workspace_onboarding_profiles;
create trigger workspace_onboarding_profile_audit
  after insert or update on public.workspace_onboarding_profiles
  for each row execute function public.record_workspace_onboarding_profile_event();

comment on table public.workspace_onboarding_profile_events is
  'Append-only audit metadata for owner-confirmed onboarding profile saves. Stores field names, source, confidence, and unknowns, not chat transcripts or field values.';

comment on column public.workspace_onboarding_profiles.schema_version is
  'Version 2 adds reviewed team-role, evidence, approval, scheduling, material, permit, quality, closeout, warranty, and communication preferences.';

commit;
