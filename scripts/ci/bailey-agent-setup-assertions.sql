-- Real PostgreSQL / RLS / constraint tests. Synthetic identities only.
\set ON_ERROR_STOP on

do $checks$
declare
  valid jsonb := '{
    "orchestrator":"off","chief_of_staff":"off","personal_calling":"off",
    "business_receptionist":"off","outbound_sales":"off","scheduling":"off",
    "customer_care":"off","roofing_estimator":"off","production_foreman":"off",
    "purchasing":"off","finance":"off","research":"off","documents":"off",
    "development":"off","quality_security":"off"
  }'::jsonb;
  rejected boolean;
  key_count integer;
begin
  if not public.bailey_agent_setup_is_valid(valid) then
    raise exception 'valid 15-agent setup rejected';
  end if;
  if public.bailey_agent_setup_is_valid(valid - 'finance') then
    raise exception 'missing agent accepted';
  end if;
  if public.bailey_agent_setup_is_valid(valid || '{"bad_agent":"off"}'::jsonb) then
    raise exception 'unknown agent accepted';
  end if;
  if public.bailey_agent_setup_is_valid(jsonb_set(valid,'{finance}','"execute"'::jsonb)) then
    raise exception 'execution mode accepted';
  end if;
  if public.bailey_agent_setup_is_valid(jsonb_set(valid,'{finance}','true'::jsonb)) then
    raise exception 'non-string preference accepted';
  end if;
  if public.bailey_agent_setup_is_valid('[]'::jsonb) or
     public.bailey_agent_setup_is_valid('"bad"'::jsonb) or
     public.bailey_agent_setup_is_valid('null'::jsonb) then
    raise exception 'non-object configuration accepted';
  end if;
  select count(*) into key_count from jsonb_object_keys(valid);
  if key_count <> 15 then raise exception 'invalid fixture count'; end if;
  if has_table_privilege('anon','public.workspace_bailey_agent_setup','select')
    or has_table_privilege('anon','public.workspace_bailey_agent_setup','insert')
    or has_table_privilege('authenticated','public.workspace_bailey_agent_setup','delete') then
    raise exception 'unexpected table grants';
  end if;
  if not has_table_privilege('authenticated','public.workspace_bailey_agent_setup','select')
    or not has_table_privilege('authenticated','public.workspace_bailey_agent_setup','insert')
    or not has_table_privilege('authenticated','public.workspace_bailey_agent_setup','update') then
    raise exception 'missing expected authenticated table grant';
  end if;
end
$checks$;

-- Workspace A owner can insert and read its configuration.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into public.workspace_bailey_agent_setup(workspace_id, setup, updated_by)
values (
 '11111111-1111-4111-8111-111111111111',
 '{
    "orchestrator":"off","chief_of_staff":"off","personal_calling":"off",
    "business_receptionist":"off","outbound_sales":"off","scheduling":"off",
    "customer_care":"off","roofing_estimator":"off","production_foreman":"off",
    "purchasing":"off","finance":"off","research":"off","documents":"off",
    "development":"off","quality_security":"off"
  }',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $owner_read$
begin
  if (select count(*) from public.workspace_bailey_agent_setup) <> 1 then
    raise exception 'workspace A owner cannot see own setup';
  end if;
end
$owner_read$;
reset role;

-- Workspace B owner must not see A's row or forge a write into A.
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $cross_workspace$
declare
  denied boolean := false;
  row_count integer;
begin
  if (select count(*) from public.workspace_bailey_agent_setup) <> 0 then
    raise exception 'workspace B owner read A setup';
  end if;
  begin
    insert into public.workspace_bailey_agent_setup (workspace_id, setup, updated_by)
    select '11111111-1111-4111-8111-111111111111', setup,
           'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    from public.workspace_bailey_agent_setup
    where workspace_id = '11111111-1111-4111-8111-111111111111';
    -- Because source is hidden by RLS, this statement inserts zero rows.
    get diagnostics row_count = row_count;
    if row_count <> 0 then raise exception 'cross-workspace insert succeeded'; end if;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    -- Explicitly attempt insert with all 15 keys, expect an RLS denial.
    begin
      insert into public.workspace_bailey_agent_setup(workspace_id,setup,updated_by)
      values (
        '11111111-1111-4111-8111-111111111111',
        (select jsonb_object_agg(agent_key,'off') from unnest(array[
          'orchestrator','chief_of_staff','personal_calling','business_receptionist',
          'outbound_sales','scheduling','customer_care','roofing_estimator',
          'production_foreman','purchasing','finance','research','documents',
          'development','quality_security'
        ]) agent_key),
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      );
    exception when insufficient_privilege then
      denied := true;
    end;
  end if;
  if not denied then raise exception 'cross-workspace insertion not blocked'; end if;
end
$cross_workspace$;
reset role;

-- Regular member can read A, cannot modify A.
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $member$
declare affected integer;
begin
  if (select count(*) from public.workspace_bailey_agent_setup) <> 1 then
    raise exception 'member cannot read own workspace';
  end if;
  update public.workspace_bailey_agent_setup
    set status='reviewed',reviewed_at=now(),updated_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where workspace_id='11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'member modified agent setup'; end if;
end
$member$;
reset role;

-- Admin can update with attribution and invalid direct writes must be rejected.
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
update public.workspace_bailey_agent_setup
  set status='reviewed',reviewed_at=now(),updated_by='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  where workspace_id='11111111-1111-4111-8111-111111111111';

do $constraints$
declare rejected boolean;
begin
  if not exists (
    select 1 from public.workspace_bailey_agent_setup
    where workspace_id='11111111-1111-4111-8111-111111111111'
      and status='reviewed'
      and updated_by='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ) then raise exception 'admin update failed'; end if;

  rejected := false;
  begin
    update public.workspace_bailey_agent_setup set
      setup=jsonb_set(setup,'{personal_calling}','"execute"'::jsonb)
    where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'direct SQL accepted operational execution preference'; end if;

  rejected := false;
  begin
    update public.workspace_bailey_agent_setup set
      status='draft',reviewed_at=now()
    where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'draft with reviewed timestamp accepted'; end if;

  rejected := false;
  begin
    update public.workspace_bailey_agent_setup set
      updated_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where workspace_id='11111111-1111-4111-8111-111111111111';
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'updated_by impersonation accepted'; end if;
end
$constraints$;
reset role;

select 'BAILEY AGENT SETUP 094: isolated PostgreSQL constraints and tenant RLS assertions passed.' as result;
