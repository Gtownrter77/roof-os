-- Run only after migrations 063, 064 and 067 are applied to the disposable database.
-- This suite extends production-job-assertions.sql, which leaves one completed
-- job in workspace A. It creates a second, active job for scheduling.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- Record the acceptance for the estimate used by the schedule tests.
insert into public.estimate_acceptances
  (id,workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
  ('ac100000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'e1000000-0000-4000-8000-000000000006','Pat Customer','phone',
   '22222222-2222-4222-8222-222222222222');

insert into public.production_jobs
  (id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('1b000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SCHEDULE-JOB',
   '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000006',
   'ac100000-0000-4000-8000-000000000006','Fake','Fake','completed',1,'2000-01-01 00:00:00+00',
   'forged','[]',1,'22222222-2222-4222-8222-222222222222');

-- 1. A plain member can read the schedule but cannot write it.
do $$
begin
  begin
    insert into public.production_job_assignments
      (workspace_id,job_id,member_user_id,role,scheduled_start,scheduled_end,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       '22222222-2222-4222-8222-222222222222','crew',now()+interval '1 day',now()+interval '2 days',
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a plain member added a crew assignment';
  exception when insufficient_privilege then
    raise notice 'Expected member assignment write denial: %',SQLERRM;
  end;

  begin
    insert into public.production_job_materials
      (workspace_id,job_id,description,quantity,unit,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       'Shingles',10,'square','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a plain member added a material line';
  exception when insufficient_privilege then
    raise notice 'Expected member material write denial: %',SQLERRM;
  end;

  if (select count(*) from public.production_job_assignments) <> 0
     or (select count(*) from public.production_job_materials) <> 0 then
    raise exception 'SECURITY FAILURE: member plan rows exist after denied writes';
  end if;
end $$;

-- 2. The owner writes the schedule. The database owns status and timestamps.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.production_job_assignments
  (id,workspace_id,job_id,member_user_id,role,scheduled_start,scheduled_end,status,notes,created_by)
values
  ('1c000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1b000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',
   'crew_lead','2026-11-02 08:00:00+00','2026-11-02 17:00:00+00','confirmed','lead',
   '11111111-1111-4111-8111-111111111111'),
  ('1c000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1b000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',
   'crew','2026-11-03 08:00:00+00','2026-11-03 17:00:00+00','scheduled','',
   '11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_job_assignments%rowtype;
begin
  select * into v from public.production_job_assignments
   where id='1c000000-0000-4000-8000-000000000001';
  if v.status <> 'scheduled' then
    raise exception 'FAILURE: a new assignment must start scheduled (got %)',v.status;
  end if;
  if v.created_at is null or v.updated_at is null then
    raise exception 'FAILURE: assignment timestamps were not set by the database';
  end if;
end $$;

-- 3. Assignment guards: workspace member, window, and immutability.
do $$
begin
  begin
    insert into public.production_job_assignments
      (workspace_id,job_id,member_user_id,role,scheduled_start,scheduled_end,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       '33333333-3333-4333-8333-333333333333','crew',now()+interval '1 day',now()+interval '2 days',
       '11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: an outsider was assigned to the crew';
  exception when check_violation then
    raise notice 'Expected outsider assignment rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_job_assignments
      (workspace_id,job_id,member_user_id,role,scheduled_start,scheduled_end,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       '22222222-2222-4222-8222-222222222222','crew',now()+interval '2 days',now()+interval '1 day',
       '11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: an inverted assignment window was accepted';
  exception when check_violation then
    raise notice 'Expected inverted window rejection: %',SQLERRM;
  end;

  begin
    update public.production_job_assignments
       set scheduled_start='2026-11-05 08:00:00+00'
     where id='1c000000-0000-4000-8000-000000000002';
    raise exception 'SECURITY FAILURE: an assignment source field was updated';
  exception when check_violation then
    raise notice 'Expected assignment immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_job_assignments
       set status='confirmed'
     where id='1c000000-0000-4000-8000-000000000001';
    -- scheduled -> confirmed is valid. Then confirmed -> scheduled must fail.
    update public.production_job_assignments
       set status='scheduled'
     where id='1c000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: confirmed assignment moved back to scheduled';
  exception when check_violation then
    raise notice 'Expected assignment transition rejection: %',SQLERRM;
  end;

  delete from public.production_job_assignments
   where id='1c000000-0000-4000-8000-000000000002';
  if not exists (select 1 from public.production_job_assignments
                  where id='1c000000-0000-4000-8000-000000000002') then
    raise exception 'SECURITY FAILURE: an assignment was deleted';
  end if;
end $$;

-- 4. Materials: linked to the job's own approved scope only.
insert into public.production_job_materials
  (id,workspace_id,job_id,line_item_id,description,quantity,unit,status,vendor,needed_by,notes,created_by)
values
  ('1d000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1b000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000005',
   'Architectural shingles',2,'square','delivered','Lumber Yard','2026-11-01','delivered early',
   '11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_job_materials%rowtype;
begin
  select * into v from public.production_job_materials
   where id='1d000000-0000-4000-8000-000000000001';
  if v.status <> 'needed' then
    raise exception 'FAILURE: a new material line must start needed (got %)',v.status;
  end if;

  begin
    insert into public.production_job_materials
      (workspace_id,job_id,line_item_id,description,quantity,unit,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       '11000000-0000-4000-8000-000000000001','Shingles',1,'square',
       '11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: a material line used another estimate''s scope';
  exception when check_violation then
    raise notice 'Expected foreign scope rejection: %',SQLERRM;
  end;

  begin
    update public.production_job_materials
       set quantity=99
     where id='1d000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: material quantity was edited';
  exception when check_violation then
    raise notice 'Expected material immutability rejection: %',SQLERRM;
  end;

  update public.production_job_materials set status='ordered'
   where id='1d000000-0000-4000-8000-000000000001';
  update public.production_job_materials set status='delivered'
   where id='1d000000-0000-4000-8000-000000000001';

  begin
    update public.production_job_materials set status='needed'
     where id='1d000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: delivered material moved back to needed';
  exception when check_violation then
    raise notice 'Expected material transition rejection: %',SQLERRM;
  end;

  delete from public.production_job_materials
   where id='1d000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.production_job_materials
                  where id='1d000000-0000-4000-8000-000000000001') then
    raise exception 'SECURITY FAILURE: a material line was deleted';
  end if;
end $$;

-- 5. Cross-workspace isolation. The owner of workspace B cannot attach a row to
--    a workspace A job, even by sending a workspace B workspace_id.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
begin
  begin
    insert into public.production_job_assignments
      (workspace_id,job_id,member_user_id,role,scheduled_start,scheduled_end,created_by)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1b000000-0000-4000-8000-000000000001',
       '33333333-3333-4333-8333-333333333333','crew',now()+interval '1 day',now()+interval '2 days',
       '33333333-3333-4333-8333-333333333333');
    raise exception 'SECURITY FAILURE: another workspace attached an assignment';
  exception when check_violation or insufficient_privilege then
    raise notice 'Expected cross-workspace assignment rejection: %',SQLERRM;
  end;
end $$;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_job_assignments;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % assignments',v_count;
  end if;
  select count(*) into v_count from public.production_job_materials;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % material lines',v_count;
  end if;
end $$;

-- 6. Members read the schedule; the handoff snapshot is unchanged.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare
  v_assignments integer;
  v_materials integer;
  v_job public.production_jobs%rowtype;
begin
  select count(*) into v_assignments from public.production_job_assignments
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_assignments <> 2 then
    raise exception 'FAILURE: member saw % assignments, expected 2',v_assignments;
  end if;

  select count(*) into v_materials from public.production_job_materials
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_materials <> 1 then
    raise exception 'FAILURE: member saw % material lines, expected 1',v_materials;
  end if;

  select * into v_job from public.production_jobs
   where id='1b000000-0000-4000-8000-000000000001';
  if v_job.accepted_total <> 1000 then
    raise exception 'FAILURE: schedule work changed the accepted amount (%)',v_job.accepted_total;
  end if;
  if v_job.scope_item_count <> 1 then
    raise exception 'FAILURE: schedule work changed the scope count (%)',v_job.scope_item_count;
  end if;
  if v_job.customer_name <> 'Pat Customer' or v_job.property_address <> '1 Main St' then
    raise exception 'FAILURE: schedule work changed the customer snapshot';
  end if;
end $$;

reset role;

select 'PASS: owner-only schedule writes, member reads, crew-lead and window guards, assignment and material immutability, status-only transitions, no delete, approved-scope link, cross-workspace isolation, handoff snapshot unchanged' as result;
