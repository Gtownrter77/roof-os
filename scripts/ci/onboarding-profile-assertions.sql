-- Exercise migration 092 as three authenticated synthetic users.
\set ON_ERROR_STOP on

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

-- A regular member may read the workspace profile but cannot create or edit it.
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$
declare denied boolean := false;
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
  denied := false;
  begin
    update public.workspace_onboarding_profiles
      set profile='{"companyType":"commercial"}',updated_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'workspace member unexpectedly updated a profile'; end if;
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
