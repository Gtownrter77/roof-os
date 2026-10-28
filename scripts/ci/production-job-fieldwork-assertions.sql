-- Run only after migrations 063, 064, 067, 068 and 069 are applied.
-- Reuses the active job created by production-job-schedule-assertions.sql.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- 1. Field-update guards: no future date, no blank note, no forged author.
do $$
begin
  begin
    insert into public.production_job_updates
      (workspace_id,job_id,work_date,note,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       current_date + 1,'future note','11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: a future-dated field update was accepted';
  exception when check_violation then
    raise notice 'Expected future-date rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_job_updates
      (workspace_id,job_id,work_date,note,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       current_date,'   ','11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: a blank field update was accepted';
  exception when check_violation then
    raise notice 'Expected blank-note rejection: %',SQLERRM;
  end;
end $$;

-- 2. A plain member records a real update. The author is the caller, not the body.
insert into public.production_job_updates
  (id,workspace_id,job_id,work_date,note,percent_complete,blockers,created_by)
values
  ('1e000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1b000000-0000-4000-8000-000000000001',current_date,'Tear-off complete',40,'Dumpster swap',
   '11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_job_updates%rowtype;
begin
  select * into v from public.production_job_updates
   where id='1e000000-0000-4000-8000-000000000001';
  if v.created_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: the update author was not stamped from the caller';
  end if;
  if v.created_at is null then
    raise exception 'FAILURE: the update timestamp was not set by the database';
  end if;
  if v.percent_complete <> 40 then
    raise exception 'FAILURE: percent complete was not stored';
  end if;
end $$;

-- 3. Members cannot edit or delete their own evidence.
update public.production_job_updates
   set note='rewritten history'
 where id='1e000000-0000-4000-8000-000000000001';

delete from public.production_job_updates
 where id='1e000000-0000-4000-8000-000000000001';

do $$
declare v_note text;
begin
  select note into v_note from public.production_job_updates
   where id='1e000000-0000-4000-8000-000000000001';
  if v_note is distinct from 'Tear-off complete' then
    raise exception 'SECURITY FAILURE: a field update was rewritten (%)',v_note;
  end if;
end $$;

-- 4. A plain member requests a change order. The request fields are server owned.
insert into public.production_job_change_orders
  (id,workspace_id,job_id,requested_by,description,reason,amount_delta,
   status,decided_by,decided_at,decision_note)
values
  ('1f000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1b000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',
   'Add ridge vent to the north slope','Owner asked for extra ventilation',1250.00,
   'approved','11111111-1111-4111-8111-111111111111',now(),'forged approval');

do $$
declare v public.production_job_change_orders%rowtype;
begin
  select * into v from public.production_job_change_orders
   where id='1f000000-0000-4000-8000-000000000001';
  if v.status <> 'requested' then
    raise exception 'FAILURE: a new change order must start requested (got %)',v.status;
  end if;
  if v.requested_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: the requester was not stamped from the caller';
  end if;
  if v.decided_by is not null or v.decided_at is not null then
    raise exception 'FAILURE: a new change order carried a decision';
  end if;
  if v.decision_note <> '' then
    raise exception 'FAILURE: a new change order carried a forged decision note';
  end if;
end $$;

-- 5. A zero amount is refused.
do $$
begin
  begin
    insert into public.production_job_change_orders
      (workspace_id,job_id,requested_by,description,amount_delta)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       '22222222-2222-4222-8222-222222222222','Zero change',0);
    raise exception 'SECURITY FAILURE: a zero-amount change order was accepted';
  exception when check_violation then
    raise notice 'Expected zero-amount rejection: %',SQLERRM;
  end;
end $$;

-- 6. A plain member cannot decide a change order.
update public.production_job_change_orders
   set status='approved'
 where id='1f000000-0000-4000-8000-000000000001';

do $$
declare v_status text;
begin
  select status into v_status from public.production_job_change_orders
   where id='1f000000-0000-4000-8000-000000000001';
  if v_status <> 'requested' then
    raise exception 'SECURITY FAILURE: a member decided a change order (%)',v_status;
  end if;
end $$;

-- 7. The owner approves. The database stamps who and when.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.production_job_change_orders
   set status='approved', decision_note='Approved after site walk'
 where id='1f000000-0000-4000-8000-000000000001';

do $$
declare v public.production_job_change_orders%rowtype;
begin
  select * into v from public.production_job_change_orders
   where id='1f000000-0000-4000-8000-000000000001';
  if v.status <> 'approved' then
    raise exception 'FAILURE: the owner approval was not stored (got %)',v.status;
  end if;
  if v.decided_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: the decider was not stamped from the caller';
  end if;
  if v.decided_at is null then
    raise exception 'FAILURE: the decision time was not stamped';
  end if;
end $$;

-- 8. A decided change order is immutable, and a second decision is refused.
do $$
begin
  begin
    update public.production_job_change_orders
       set status='declined'
     where id='1f000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: an approved change order was re-decided';
  exception when check_violation then
    raise notice 'Expected decided-immutability rejection: %',SQLERRM;
  end;
end $$;

-- 9. Request fields are immutable while the request is pending.
insert into public.production_job_change_orders
  (id,workspace_id,job_id,requested_by,description,reason,amount_delta)
values
  ('1f000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1b000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',
   'Credit for unused flashing','Fewer bundles used',-250.00);

do $$
begin
  begin
    update public.production_job_change_orders
       set status='approved', amount_delta=250.00
     where id='1f000000-0000-4000-8000-000000000002';
    raise exception 'SECURITY FAILURE: a decision rewrote the requested amount';
  exception when check_violation then
    raise notice 'Expected request-field immutability rejection: %',SQLERRM;
  end;

  update public.production_job_change_orders
     set status='declined', decision_note='Credit withdrawn on review'
   where id='1f000000-0000-4000-8000-000000000002';

  delete from public.production_job_change_orders
   where id='1f000000-0000-4000-8000-000000000002';
  if not exists (select 1 from public.production_job_change_orders
                  where id='1f000000-0000-4000-8000-000000000002') then
    raise exception 'SECURITY FAILURE: a change order was deleted';
  end if;
end $$;

-- 10. Another workspace cannot write either table.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
begin
  begin
    insert into public.production_job_updates
      (workspace_id,job_id,work_date,note)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1b000000-0000-4000-8000-000000000001',
       current_date,'outsider update');
    raise exception 'SECURITY FAILURE: another workspace posted a field update';
  exception when check_violation or insufficient_privilege then
    raise notice 'Expected cross-workspace update rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_job_change_orders
      (workspace_id,job_id,description,amount_delta)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1b000000-0000-4000-8000-000000000001',
       'outsider change',500);
    raise exception 'SECURITY FAILURE: another workspace requested a change order';
  exception when check_violation or insufficient_privilege then
    raise notice 'Expected cross-workspace change-order rejection: %',SQLERRM;
  end;
end $$;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_job_updates;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % field updates',v_count;
  end if;
  select count(*) into v_count from public.production_job_change_orders;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % change orders',v_count;
  end if;
end $$;

-- 11. A member reads both records; the handoff snapshot is still unchanged.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare
  v_updates integer;
  v_orders integer;
  v_job public.production_jobs%rowtype;
begin
  select count(*) into v_updates from public.production_job_updates
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_updates <> 1 then
    raise exception 'FAILURE: member saw % field updates, expected 1',v_updates;
  end if;

  select count(*) into v_orders from public.production_job_change_orders
   where job_id='1b000000-0000-4000-8000-000000000001';
  if v_orders <> 2 then
    raise exception 'FAILURE: member saw % change orders, expected 2',v_orders;
  end if;

  select * into v_job from public.production_jobs
   where id='1b000000-0000-4000-8000-000000000001';
  if v_job.accepted_total <> 1000 or v_job.scope_item_count <> 1 then
    raise exception 'FAILURE: field evidence changed the handoff amount or scope';
  end if;
  if v_job.customer_name <> 'Pat Customer' or v_job.property_address <> '1 Main St' then
    raise exception 'FAILURE: field evidence changed the customer snapshot';
  end if;
end $$;

-- 12. A completed job refuses new field evidence and change orders.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.production_jobs set status='in_progress'
 where id='1b000000-0000-4000-8000-000000000001';
update public.production_jobs set status='completed'
 where id='1b000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    insert into public.production_job_updates
      (workspace_id,job_id,work_date,note)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       current_date,'late update');
    raise exception 'SECURITY FAILURE: a completed job took a field update';
  exception when check_violation then
    raise notice 'Expected completed-job update rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_job_change_orders
      (workspace_id,job_id,description,amount_delta)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1b000000-0000-4000-8000-000000000001',
       'late change',100);
    raise exception 'SECURITY FAILURE: a completed job took a change order';
  exception when check_violation then
    raise notice 'Expected completed-job change-order rejection: %',SQLERRM;
  end;
end $$;

-- 13. The triggers refuse edit and delete even for a caller that bypasses RLS.
reset role;

do $$
begin
  begin
    update public.production_job_updates
       set note='superuser rewrite'
     where id='1e000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the update trigger allowed an edit';
  exception when check_violation then
    raise notice 'Expected update immutability trigger: %',SQLERRM;
  end;

  begin
    delete from public.production_job_updates
     where id='1e000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the update trigger allowed a delete';
  exception when check_violation then
    raise notice 'Expected update delete trigger: %',SQLERRM;
  end;

  begin
    update public.production_job_change_orders
       set decision_note='superuser rewrite'
     where id='1f000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the change-order trigger allowed an edit';
  exception when check_violation then
    raise notice 'Expected change-order immutability trigger: %',SQLERRM;
  end;

  begin
    delete from public.production_job_change_orders
     where id='1f000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the change-order trigger allowed a delete';
  exception when check_violation then
    raise notice 'Expected change-order delete trigger: %',SQLERRM;
  end;
end $$;

select 'PASS: append-only field updates, server-owned authors and times, member requests, owner-only decisions, stamped decider, request immutability, no re-decision, no delete, completed-job refusal, cross-workspace denial, handoff snapshot unchanged' as result;
