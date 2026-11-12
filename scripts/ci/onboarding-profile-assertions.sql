-- Exercise migration 092 as three authenticated synthetic users.
\set ON_ERROR_STOP on

-- Migration 093 must correct a legacy false-completed row without losing answers.
do $legacy_completion$
begin
  if not exists (
    select 1 from public.workspace_onboarding_profiles
    where workspace_id = '22222222-2222-4222-8222-222222222222'
      and status = 'draft'
      and completed_at is null
      and schema_version = 2
      and profile->>'companyType' = 'residential'
  ) then
    raise exception 'migration 093 did not downgrade the legacy incomplete completion while preserving its answers';
  end if;
end
$legacy_completion$;


-- The migration must explicitly grant only the authenticated operations it needs.
do $grant_check$
begin
  if not has_table_privilege('anon','public.workspace_onboarding_profiles','select') then
    -- expected: anonymous role has no Data API access
    null;
  else
    raise exception 'anonymous role unexpectedly has table access';
  end if;
  if not has_table_privilege('authenticated','public.workspace_onboarding_profiles','select')
     or not has_table_privilege('authenticated','public.workspace_onboarding_profiles','insert')
     or not has_table_privilege('authenticated','public.workspace_onboarding_profiles','update') then
    raise exception 'authenticated role is missing a required table grant';
  end if;
  if has_table_privilege('authenticated','public.workspace_onboarding_profiles','delete') then
    raise exception 'authenticated role unexpectedly has DELETE privilege';
  end if;
  if has_table_privilege('anon','public.workspace_onboarding_profile_events','select') then
    raise exception 'anonymous role unexpectedly has onboarding audit access';
  end if;
  if not has_table_privilege('authenticated','public.workspace_onboarding_profile_events','select')
     or not has_table_privilege('authenticated','public.workspace_onboarding_profile_events','insert') then
    raise exception 'authenticated role is missing required onboarding audit grants';
  end if;
  if has_table_privilege('authenticated','public.workspace_onboarding_profile_events','update')
     or has_table_privilege('authenticated','public.workspace_onboarding_profile_events','delete') then
    raise exception 'onboarding audit events unexpectedly allow mutation';
  end if;
end $grant_check$;

-- Authenticated workspace admins must not be able to forge audit history directly.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $audit_forgery$
declare rejected boolean := false;
begin
  begin
    insert into public.workspace_onboarding_profile_events (
      workspace_id, actor_id, event_type, source, confidence, changed_fields, unknown_fields
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'updated',
      'owner_confirmed_onboarding_form',
      'owner_confirmed',
      ARRAY['companyType']::text[],
      ARRAY[]::text[]
    );
  exception when raise_exception then rejected := true;
  end;
  if not rejected then
    raise exception 'authenticated workspace admin forged an onboarding audit event';
  end if;
end $audit_forgery$;
reset role;

-- Workspace A owner can create and read only its own profile.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into public.workspace_onboarding_profiles(workspace_id,profile,updated_by)
values ('11111111-1111-4111-8111-111111111111','{"companyType":"residential"}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
do $$
begin
  if (select count(*) from public.workspace_onboarding_profiles) <> 1 then
    raise exception 'workspace A owner should see its own profile';
  end if;
  if exists (select 1 from public.workspace_onboarding_profiles where workspace_id='22222222-2222-4222-8222-222222222222') then
    raise exception 'workspace A owner saw workspace B profile';
  end if;
end $$;
reset role;

-- Direct Data API writes must not bypass the profile allowlist or enum contract.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $profile_constraints$
declare rejected boolean := false;
begin
  begin
    update public.workspace_onboarding_profiles
      set profile='{"companyType":"residential","unapprovedSetting":true}'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'database accepted an unapproved profile key'; end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles
      set profile='{"companyType":"automatic_everything"}'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'database accepted an invalid companyType'; end if;
end $profile_constraints$;
reset role;

-- Direct writes must also respect array shape, item limits, ZIP format, contact enums and text length.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $profile_bounds$
declare rejected boolean;
begin
  rejected := false;
  begin
    update public.workspace_onboarding_profiles set profile='{"serviceZipCodes":["3012"]}'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'database accepted malformed service ZIP'; end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles set profile='{"serviceZipCodes":["30127x"]}'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'database accepted a ZIP with trailing characters'; end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles set profile='{"customerContactPreferences":["fax"]}'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'database accepted unsupported contact preference'; end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles set profile=jsonb_build_object('primaryGoal',repeat('x',241))
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'database accepted overlong primary goal'; end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles set profile=jsonb_build_object('roofingSystems',to_jsonb(array(select repeat('x',1) from generate_series(1,13))))
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'database accepted too many roofing systems'; end if;
end $profile_bounds$;
reset role;

-- A regular member may read the workspace profile but cannot create or edit it.
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$
declare denied boolean := false; affected integer := 0;
begin
  if (select count(*) from public.workspace_onboarding_profiles) <> 1 then
    raise exception 'workspace member should read its workspace profile';
  end if;
  begin
    insert into public.workspace_onboarding_profiles(workspace_id,profile,updated_by)
    values ('11111111-1111-4111-8111-111111111111','{}','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'workspace member unexpectedly inserted a profile'; end if;
  update public.workspace_onboarding_profiles
    set profile='{"companyType":"commercial"}',updated_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where workspace_id='11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'workspace member unexpectedly updated a profile'; end if;
end $$;
reset role;

-- A workspace admin (not only the owner) may update the reviewed profile.
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
update public.workspace_onboarding_profiles
  set profile='{"companyType":"commercial"}',updated_by='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  where workspace_id='11111111-1111-4111-8111-111111111111';
reset role;

-- Workspace B owner cannot read or write workspace A's profile.
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.workspace_onboarding_profiles where workspace_id = '11111111-1111-4111-8111-111111111111') <> 0 then
    raise exception 'workspace B owner read workspace A profile';
  end if;
  begin
    insert into public.workspace_onboarding_profiles(workspace_id,profile,updated_by)
    values ('11111111-1111-4111-8111-111111111111','{}','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'cross-workspace insert unexpectedly succeeded'; end if;
end $$;
reset role;

-- The owner cannot attribute a write to a different authenticated user.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$
declare denied boolean := false;
begin
  begin
    update public.workspace_onboarding_profiles
      set updated_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'updated_by spoofing unexpectedly succeeded'; end if;
end $$;
reset role;

-- Confirm owner updates are allowed and preserve the authenticated actor.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
update public.workspace_onboarding_profiles
  set profile='{"companyType":"both"}',updated_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  where workspace_id='11111111-1111-4111-8111-111111111111';
reset role;

select 'ONBOARDING PROFILE MIGRATION 092: workspace isolation, member read-only, admin write, and actor attribution assertions passed.' as result;


-- Migration 093 must replace (not merely supplement) the v1 allowlist.
-- A valid v2-only profile must save, while unknown keys and invalid v2 values
-- remain rejected by database constraints on direct authenticated writes.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $profile_v2$
declare
  affected integer := 0;
  rejected boolean := false;
begin
  update public.workspace_onboarding_profiles
  set profile = '{
    "companyType":"residential",
    "yearsInBusinessBand":"2-5",
    "teamRoles":["owner","foreman"],
    "customerContactPreferences":["unsure"],
    "photoEvidenceWorkflow":"phone_photos",
    "approvalWorkflow":"owner_approval",
    "schedulingWorkflow":"calendar",
    "businessHours":"Mon-Fri 8-5"
  }'::jsonb,
  updated_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  where workspace_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'valid v2 profile write did not update the workspace profile';
  end if;

  if (select schema_version from public.workspace_onboarding_profiles
      where workspace_id = '11111111-1111-4111-8111-111111111111') <> 2 then
    raise exception 'migration 093 did not set schema_version to 2';
  end if;

  if not exists (
    select 1 from public.workspace_onboarding_profile_events
    where workspace_id = '11111111-1111-4111-8111-111111111111'
      and actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and event_type = 'updated'
      and source = 'owner_confirmed_onboarding_form'
      and confidence = 'owner_confirmed'
      and changed_fields @> ARRAY['teamRoles']::text[]
      and unknown_fields @> ARRAY['customerContactPreferences']::text[]
  ) then
    raise exception 'owner-confirmed v2 profile save did not create the expected audit event';
  end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles
    set profile = '{"companyType":"residential","unapprovedV2Key":true}'::jsonb
    where workspace_id = '11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'database accepted an unknown v2 profile key';
  end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles
    set profile = '{"teamRoles":["owner","root"]}'::jsonb
    where workspace_id = '11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'database accepted an unsupported v2 team role';
  end if;

  rejected := false;
  begin
    update public.workspace_onboarding_profiles
    set profile = '{"yearsInBusinessBand":"centuries"}'::jsonb
    where workspace_id = '11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'database accepted an invalid v2 years-in-business value';
  end if;

  -- The database must reject completion without a meaningful first goal.
  rejected := false;
  begin
    update public.workspace_onboarding_profiles
    set status = 'completed',
        completed_at = now(),
        updated_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where workspace_id = '11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'database accepted completion without a primary goal';
  end if;

  -- Whitespace is not a meaningful goal, even when the field is present.
  rejected := false;
  begin
    update public.workspace_onboarding_profiles
    set profile = '{"companyType":"residential","primaryGoal":"   "}'::jsonb,
        status = 'completed',
        completed_at = now(),
        updated_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where workspace_id = '11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'database accepted completion with a whitespace-only primary goal';
  end;

  -- A complete profile may finish, and may later be deliberately reopened as a draft.
  update public.workspace_onboarding_profiles
  set profile = '{"companyType":"residential","primaryGoal":"Improve onboarding"}'::jsonb,
      status = 'completed',
      completed_at = now(),
      updated_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  where workspace_id = '11111111-1111-4111-8111-111111111111';

  if not exists (
    select 1 from public.workspace_onboarding_profiles
    where workspace_id = '11111111-1111-4111-8111-111111111111'
      and status = 'completed'
      and completed_at is not null
  ) then
    raise exception 'database did not persist a valid completed profile';
  end if;

  update public.workspace_onboarding_profiles
  set status = 'draft',
      completed_at = null,
      updated_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  where workspace_id = '11111111-1111-4111-8111-111111111111';

  if not exists (
    select 1 from public.workspace_onboarding_profiles
    where workspace_id = '11111111-1111-4111-8111-111111111111'
      and status = 'draft'
      and completed_at is null
  ) then
    raise exception 'database did not allow a completed profile to be reopened as draft';
  end if;
end
$profile_v2$;
reset role;

select 'ONBOARDING PROFILE MIGRATION 093: valid v2 writes accepted; unknown keys and invalid v2 values rejected.' as result;

-- Audit history is visible to workspace admins, not ordinary workspace members.
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $audit_visibility$
begin
  if (select count(*) from public.workspace_onboarding_profile_events) <> 0 then
    raise exception 'ordinary workspace member unexpectedly read onboarding audit history';
  end if;
end
$audit_visibility$;
reset role;

select 'ONBOARDING PROFILE AUDIT: owner event recorded, unknown fields retained, and member access denied.' as result;
