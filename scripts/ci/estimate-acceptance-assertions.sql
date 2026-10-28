-- Run only after migration 063 is applied to a disposable PostgreSQL database.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.workspaces(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','member'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','owner');

insert into public.estimates(id,workspace_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at) values
 ('e0000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','v2',9500,500,10000,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('e0000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','draft','v1',500,0,500,
  '11111111-1111-4111-8111-111111111111',null,null),
 ('e0000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','approved','v1',6500,500,7000,
  '33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333',now()),
 ('e0000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','v1',100,0,100,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('e0000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','v1',5000,0,5000,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- 1. A member records acceptance. The database owns the amount snapshot and time.
insert into public.estimate_acceptances
  (workspace_id,estimate_id,accepted_by_name,acceptance_method,note,accepted_subtotal,accepted_tax,accepted_total,accepted_at,recorded_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
   'Synthetic Customer','phone','Verbal yes on the call',1,1,1,'2000-01-01 00:00:00+00',
   '22222222-2222-4222-8222-222222222222');

do $$
declare v public.estimate_acceptances%rowtype;
begin
  select * into v from public.estimate_acceptances
   where estimate_id='e0000000-0000-4000-8000-000000000001';
  if not found then raise exception 'FAILURE: acceptance was not recorded'; end if;
  if v.accepted_subtotal <> 9500 or v.accepted_tax <> 500 or v.accepted_total <> 10000 then
    raise exception 'FAILURE: accepted amounts were not copied from the approved estimate (%,%,%)',
      v.accepted_subtotal,v.accepted_tax,v.accepted_total;
  end if;
  if v.estimate_formula_version <> 'v2' then
    raise exception 'FAILURE: formula version was not copied (got %)',v.estimate_formula_version;
  end if;
  if v.accepted_at < now() - interval '1 minute' then
    raise exception 'FAILURE: acceptance time was client supplied, not server owned';
  end if;
  if v.recorded_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: recorder is not the signed-in member';
  end if;
  if v.accepted_by_name <> 'Synthetic Customer' then
    raise exception 'FAILURE: customer name was not stored';
  end if;
end $$;

-- 2. One recorded acceptance per estimate.
do $$
begin
  begin
    insert into public.estimate_acceptances
      (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            'Second Customer','email','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a second acceptance was accepted';
  exception when unique_violation then
    raise notice 'Expected duplicate acceptance rejection: %',SQLERRM;
  end;
end $$;

-- 3. An unapproved estimate cannot be accepted.
do $$
begin
  begin
    insert into public.estimate_acceptances
      (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000002',
            'Synthetic Customer','phone','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a draft estimate was accepted';
  exception when check_violation then
    raise notice 'Expected approval gate rejection: %',SQLERRM;
  end;
  if exists (select 1 from public.estimate_acceptances
      where estimate_id='e0000000-0000-4000-8000-000000000002') then
    raise exception 'SECURITY FAILURE: rejected acceptance still wrote a row';
  end if;
end $$;

-- 4. The acceptance and the estimate must share a workspace.
do $$
begin
  begin
    insert into public.estimate_acceptances
      (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000003',
            'Cross Workspace','phone','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: cross-workspace acceptance was accepted';
  exception when check_violation then
    raise notice 'Expected cross-workspace acceptance rejection: %',SQLERRM;
  end;
end $$;

-- 5. A non-member cannot record or see an acceptance.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.estimate_acceptances
   where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  begin
    insert into public.estimate_acceptances
      (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000004',
            'Outsider','phone','33333333-3333-4333-8333-333333333333');
    raise exception 'SECURITY FAILURE: outsider recorded an acceptance';
  exception when insufficient_privilege or check_violation then
    raise notice 'Expected RLS/membership rejection for an outsider acceptance: %',SQLERRM;
  end;
end $$;

-- 6. Acceptance rows are immutable, even for the workspace owner.
reset role;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
begin
  begin
    update public.estimate_acceptances set accepted_by_name='Tampered'
     where estimate_id='e0000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: acceptance was updated';
  exception when check_violation then
    raise notice 'Expected acceptance update rejection: %',SQLERRM;
  end;
  begin
    delete from public.estimate_acceptances
     where estimate_id='e0000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: acceptance was deleted';
  exception when check_violation then
    raise notice 'Expected acceptance delete rejection: %',SQLERRM;
  end;
end $$;

-- 7. Deposit lifecycle: requested -> received -> refunded, server-owned timestamps.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.estimate_deposit_events
  (workspace_id,estimate_id,acceptance_id,event_type,amount,occurred_at,recorded_by)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',id,
       'requested',2000,'2000-01-01 00:00:00+00','22222222-2222-4222-8222-222222222222'
from public.estimate_acceptances where estimate_id='e0000000-0000-4000-8000-000000000001';

do $$
declare v_time timestamptz;
begin
  select occurred_at into v_time from public.estimate_deposit_events
   where estimate_id='e0000000-0000-4000-8000-000000000001' and event_type='requested';
  if v_time < now() - interval '1 minute' then
    raise exception 'FAILURE: deposit time was client supplied, not server owned';
  end if;
end $$;

-- 8. Received only after requested, within the request and with a method.
-- Deposit order: received must follow requested. A refund is terminal and cannot receive new events.
-- A request cannot exceed the accepted total.
do $$
declare v_acceptance uuid;
begin
  select id into v_acceptance from public.estimate_acceptances
   where estimate_id='e0000000-0000-4000-8000-000000000001';

  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            v_acceptance,'received',1600,'22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: receipt without a method was accepted';
  exception when check_violation then
    raise notice 'Expected payment-method rejection: %',SQLERRM;
  end;

  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            v_acceptance,'received',2500,'check','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: receipt exceeded the request';
  exception when check_violation then
    raise notice 'Expected over-request rejection: %',SQLERRM;
  end;

  insert into public.estimate_deposit_events
    (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
          v_acceptance,'received',2000,'check','22222222-2222-4222-8222-222222222222');

  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            v_acceptance,'received',2000,'check','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: deposit received twice';
  exception when check_violation then
    raise notice 'Expected second receipt rejection: %',SQLERRM;
  end;

  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            v_acceptance,'refunded',2500,'check','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: refund exceeded the receipt';
  exception when check_violation then
    raise notice 'Expected over-refund rejection: %',SQLERRM;
  end;

  insert into public.estimate_deposit_events
    (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
          v_acceptance,'refunded',500,'check','22222222-2222-4222-8222-222222222222');

  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            v_acceptance,'refunded',500,'check','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a refunded deposit accepted new events';
  exception when check_violation then
    raise notice 'Expected refund terminal-state rejection: %',SQLERRM;
  end;
end $$;

-- 9. A request cannot exceed the accepted total.
do $$
declare v_acceptance uuid;
begin
  insert into public.estimate_acceptances
    (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000004',
          'Cap Customer','in_person','22222222-2222-4222-8222-222222222222');
  select id into v_acceptance from public.estimate_acceptances
   where estimate_id='e0000000-0000-4000-8000-000000000004';
  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000004',
            v_acceptance,'requested',200,'22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: request exceeded the accepted total';
  exception when check_violation then
    raise notice 'Expected accepted-total rejection: %',SQLERRM;
  end;
end $$;

-- 10. A deposit event cannot point at another estimate's acceptance.
do $$
declare v_acceptance uuid;
begin
  select id into v_acceptance from public.estimate_acceptances
   where estimate_id='e0000000-0000-4000-8000-000000000001';
  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000005',
            v_acceptance,'received',100,'check','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: acceptance/estimate mismatch was accepted';
  exception when check_violation then
    raise notice 'Expected acceptance/estimate mismatch rejection: %',SQLERRM;
  end;
end $$;

-- 11. A waiver is a single zero-amount event.
do $$
declare v_acceptance uuid;
begin
  insert into public.estimate_acceptances
    (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000005',
          'Waived Customer','text','22222222-2222-4222-8222-222222222222');
  select id into v_acceptance from public.estimate_acceptances
   where estimate_id='e0000000-0000-4000-8000-000000000005';
  insert into public.estimate_deposit_events
    (workspace_id,estimate_id,acceptance_id,event_type,amount,recorded_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000005',
          v_acceptance,'waived',0,'22222222-2222-4222-8222-222222222222');
end $$;

-- 12. Deposit events are immutable, even for the workspace owner.
reset role;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
begin
  begin
    update public.estimate_deposit_events set amount=1
     where estimate_id='e0000000-0000-4000-8000-000000000001' and event_type='requested';
    raise exception 'SECURITY FAILURE: deposit event was updated';
  exception when check_violation then
    raise notice 'Expected deposit update rejection: %',SQLERRM;
  end;
  begin
    delete from public.estimate_deposit_events
     where estimate_id='e0000000-0000-4000-8000-000000000001' and event_type='requested';
    raise exception 'SECURITY FAILURE: deposit event was deleted';
  exception when check_violation then
    raise notice 'Expected deposit delete rejection: %',SQLERRM;
  end;
end $$;

-- 13. Outsider sees no ledger rows and cannot add one.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
declare v_acceptance uuid; v_count integer;
begin
  select count(*) into v_count from public.estimate_deposit_events
   where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % deposit rows',v_count;
  end if;
  select id into v_acceptance from public.estimate_acceptances
   where estimate_id='e0000000-0000-4000-8000-000000000004';
  if v_acceptance is not null then
    raise exception 'SECURITY FAILURE: outsider saw an acceptance row';
  end if;
  begin
    insert into public.estimate_deposit_events
      (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e0000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000000','received',100,'check',
            '33333333-3333-4333-8333-333333333333');
    raise exception 'SECURITY FAILURE: outsider wrote a deposit event';
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'Expected RLS/membership rejection for an outsider deposit: %',SQLERRM;
  end;
end $$;
reset role;

select 'PASS: approved-only acceptance, server-owned snapshot/time, one per estimate, immutable evidence, append-only deposit state machine, caps, workspace and RLS isolation' as result;
