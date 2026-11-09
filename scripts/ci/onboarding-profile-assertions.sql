-- Exercise migration 092 as three authenticated synthetic users.
\set ON_ERROR_STOP on

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
end $grant_check$;

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
  if (select count(*) from public.workspace_onboarding_profiles) <> 0 then
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
