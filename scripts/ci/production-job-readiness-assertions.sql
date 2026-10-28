-- Run only after migrations 063, 064, 067 and 068 are applied.
-- Reuses the active job created by production-job-schedule-assertions.sql.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- 1. A plain member cannot write readiness.
do $$
begin
  begin
    insert into public.production_job_readiness
      (workspace_id,job_id,permit_status,permit_reference,weather_decision,weather_source)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       'issued','MEMBER-FORGED','clear','member forged');
    raise exception 'SECURITY FAILURE: a plain member recorded readiness';
  exception when insufficient_privilege then
    raise notice 'Expected member readiness write denial: %',SQLERRM;
  end;
end $$;

-- 2. The owner records the first decision. The database owns timestamps.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.production_job_readiness
  (workspace_id,job_id,permit_status,permit_reference,weather_decision,weather_source)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
   'unknown','','unknown','');

do $$
declare v public.production_job_readiness%rowtype;
begin
  select * into v from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  if not found then raise exception 'FAILURE: readiness row was not created'; end if;
  if v.permit_checked_at is not null or v.weather_checked_at is not null then
    raise exception 'FAILURE: unknown decisions must not carry a check time';
  end if;
  if v.updated_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: updated_by was not stamped from the caller';
  end if;
end $$;

-- 3. Issuing a permit and clearing the weather stamps who and when.
update public.production_job_readiness
   set permit_status='issued', permit_reference='PRM-2026-0042'
 where job_id='1b000000-0000-4000-8000-000000000001';

update public.production_job_readiness
   set weather_decision='clear', weather_source='Owner checked NWS forecast 2026-10-28'
 where job_id='1b000000-0000-4000-8000-000000000001';

do $$
declare v public.production_job_readiness%rowtype;
begin
  select * into v from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v.permit_checked_at is null or v.permit_checked_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: permit decision was not stamped by the database';
  end if;
  if v.weather_checked_at is null or v.weather_checked_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: weather decision was not stamped by the database';
  end if;
  if v.permit_reference <> 'PRM-2026-0042' then
    raise exception 'FAILURE: permit reference was not stored';
  end if;
end $$;

-- 4. Editing a reference does not fake a fresh check.
do $$
declare
  v_before public.production_job_readiness%rowtype;
  v_after public.production_job_readiness%rowtype;
begin
  select * into v_before from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  update public.production_job_readiness
     set permit_reference='PRM-2026-0042-REV'
   where job_id='1b000000-0000-4000-8000-000000000001';
  select * into v_after from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_after.permit_checked_by is distinct from v_before.permit_checked_by then
    raise exception 'FAILURE: a reference edit restamped the permit checker';
  end if;
  update public.production_job_readiness
     set permit_status='unknown', permit_reference=''
   where job_id='1b000000-0000-4000-8000-000000000001';
  select * into v_after from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_after.permit_checked_at is not null or v_after.permit_checked_by is not null then
    raise exception 'FAILURE: unknown permit kept a check stamp';
  end if;
end $$;

-- 5. Invalid status and a second row for the same job are refused.
do $$
begin
  begin
    update public.production_job_readiness
       set permit_status='approved'
     where job_id='1b000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: an unsupported permit status was accepted';
  exception when check_violation then
    raise notice 'Expected permit enum rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_job_readiness
      (workspace_id,job_id,permit_status,permit_reference,weather_decision,weather_source)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       'unknown','','unknown','');
    raise exception 'SECURITY FAILURE: a second readiness row was accepted for one job';
  exception when unique_violation then
    raise notice 'Expected one-readiness-row rejection: %',SQLERRM;
  end;
end $$;

-- 6. Job and workspace are immutable; delete is refused.
do $$
begin
  begin
    update public.production_job_readiness
       set job_id='1c000000-0000-4000-8000-000000000001'
     where job_id='1b000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: readiness was moved to another job';
  exception when check_violation then
    raise notice 'Expected readiness job immutability rejection: %',SQLERRM;
  end;

  delete from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.production_job_readiness
                  where job_id='1b000000-0000-4000-8000-000000000001') then
    raise exception 'SECURITY FAILURE: a readiness row was deleted';
  end if;
end $$;

-- 7. Another workspace cannot attach a row to this job.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
begin
  begin
    insert into public.production_job_readiness
      (workspace_id,job_id,permit_status,permit_reference,weather_decision,weather_source)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1b000000-0000-4000-8000-000000000001',
       'issued','OUTSIDER','clear','outsider');
    raise exception 'SECURITY FAILURE: another workspace recorded readiness';
  exception when check_violation or insufficient_privilege then
    raise notice 'Expected cross-workspace readiness rejection: %',SQLERRM;
  end;
end $$;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_job_readiness;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % readiness rows',v_count;
  end if;
end $$;

-- 8. A member reads the row; the handoff snapshot is still unchanged.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare
  v_count integer;
  v_job public.production_jobs%rowtype;
begin
  select count(*) into v_count from public.production_job_readiness
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_count <> 1 then
    raise exception 'FAILURE: member saw % readiness rows, expected 1',v_count;
  end if;

  select * into v_job from public.production_jobs
   where id='1b000000-0000-4000-8000-000000000001';
  if v_job.accepted_total <> 1000 or v_job.scope_item_count <> 1 then
    raise exception 'FAILURE: readiness work changed the handoff';
  end if;
  if v_job.customer_name <> 'Pat Customer' then
    raise exception 'FAILURE: readiness work changed the customer snapshot';
  end if;
end $$;

reset role;

select 'PASS: owner-only readiness writes, member reads, server-stamped permit and weather checks, reference edits do not restamp, unknown clears stamps, one row per job, job/workspace immutable, no delete, cross-workspace denial, handoff unchanged' as result;
