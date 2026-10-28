-- Run only after migrations 063 and 064 are applied to a disposable database.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
insert into public.workspaces(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','member'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','owner');

insert into public.leads(id,workspace_id,owner_id,name,address,status) values
 ('1a000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','Pat Customer','1 Main St','report_approved'),
 ('1a000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','Lost Customer','2 Lost Rd','lost'),
 ('1a000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '33333333-3333-4333-8333-333333333333','Other Customer','3 Other Ave','qualified'),
 ('1a000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','Wrong Customer','4 Wrong Way','qualified');

insert into public.estimates(id,workspace_id,lead_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at) values
 ('e1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '1a000000-0000-4000-8000-000000000001','approved','v2',9500,500,10000,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('e1000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '1a000000-0000-4000-8000-000000000001','draft','v1',500,0,500,
  '11111111-1111-4111-8111-111111111111',null,null),
 ('e1000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '1a000000-0000-4000-8000-000000000002','approved','v1',7000,0,7000,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('e1000000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '1a000000-0000-4000-8000-000000000003','approved','v1',7000,0,7000,
  '33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333',now()),
 ('e1000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '1a000000-0000-4000-8000-000000000001','approved','v1',0,0,0,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('e1000000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '1a000000-0000-4000-8000-000000000001','approved','v1',1000,0,1000,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now()),
 ('e1000000-0000-4000-8000-000000000007','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '1a000000-0000-4000-8000-000000000001','approved','v1',500,0,500,
  '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());

insert into public.estimate_line_items(id,estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot) values
 ('11000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',
  'SHN-30','Architectural shingles','material','square',10,500,5000,'{"source":"price_book","sku":"SHN-30"}'),
 ('11000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',
  'LAB-INST','Install shingles','labor','hour',40,112.5,4500,'{"source":"price_book","sku":"LAB-INST"}'),
 ('11000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003',
  'SHN-30','Architectural shingles','material','square',14,500,7000,'{"source":"price_book","sku":"SHN-30"}'),
 ('11000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000004',
  'SHN-30','Architectural shingles','material','square',14,500,7000,'{"source":"price_book","sku":"SHN-30"}'),
 ('11000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000006',
  'SHN-30','Architectural shingles','material','square',2,500,1000,'{"source":"price_book","sku":"SHN-30"}');

set role authenticated;

-- Record acceptances for the estimates that should reach the handoff gate.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.estimate_acceptances
  (workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000001','Pat Customer','phone','22222222-2222-4222-8222-222222222222'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000003','Lost Customer','phone','22222222-2222-4222-8222-222222222222'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000005','Pat Customer','text','22222222-2222-4222-8222-222222222222'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000007','Pat Customer','email','22222222-2222-4222-8222-222222222222');

-- 1. A member creates the handoff. Every source field is overwritten from the database.
insert into public.production_jobs
  (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','HACKED',
   '1a000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000001',
   (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000001'),
   'Fake Name','Fake Address','completed',1,'2000-01-01 00:00:00+00','forged','[]',1,
   '22222222-2222-4222-8222-222222222222');

do $$
declare v public.production_jobs%rowtype;
begin
  select * into v from public.production_jobs
   where estimate_id='e1000000-0000-4000-8000-000000000001';
  if not found then raise exception 'FAILURE: production job was not created'; end if;
  if v.job_number not like 'JOB-%' then
    raise exception 'FAILURE: job number was client supplied (got %)',v.job_number;
  end if;
  if v.lead_id <> '1a000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'FAILURE: lead was not copied from the estimate';
  end if;
  if v.customer_name <> 'Pat Customer' or v.property_address <> '1 Main St' then
    raise exception 'FAILURE: customer snapshot was not copied from the lead';
  end if;
  if v.status <> 'ready' then
    raise exception 'FAILURE: a new job must start ready (got %)',v.status;
  end if;
  if v.accepted_total <> 10000 then
    raise exception 'FAILURE: accepted total was not copied from the acceptance (got %)',v.accepted_total;
  end if;
  if v.estimate_formula_version <> 'v2' then
    raise exception 'FAILURE: formula version was not copied (got %)',v.estimate_formula_version;
  end if;
  if v.accepted_at < now() - interval '1 minute' then
    raise exception 'FAILURE: accepted time was client supplied, not copied from acceptance';
  end if;
  if v.scope_item_count <> 2 or jsonb_array_length(v.approved_scope) <> 2 then
    raise exception 'FAILURE: approved scope was not copied (count %, json %)',v.scope_item_count,jsonb_array_length(v.approved_scope);
  end if;
  if v.approved_scope->0->>'item_code' <> 'SHN-30'
     or v.approved_scope->0->'source_snapshot'->>'source' <> 'price_book' then
    raise exception 'FAILURE: approved scope lost its source evidence: %',v.approved_scope;
  end if;
  if v.created_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: creator is not the signed-in member';
  end if;
end $$;

-- 2. One writer marks the customer won and sets the production next action.
do $$
declare v public.leads%rowtype;
begin
  select * into v from public.leads where id='1a000000-0000-4000-8000-000000000001';
  if v.status <> 'won' then
    raise exception 'FAILURE: lead is not won after handoff (got %)',v.status;
  end if;
  if v.next_action <> 'Prepare production job' then
    raise exception 'FAILURE: lead next action was not set (got %)',v.next_action;
  end if;
  if v.next_action_owner_id <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: lead next action owner is not the handoff creator';
  end if;
end $$;

-- 3. One job per estimate.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SECOND',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000001'),
       'Pat Customer','1 Main St','ready',10000,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a second job was created for one estimate';
  exception when unique_violation then
    raise notice 'Expected one-job-per-estimate rejection: %',SQLERRM;
  end;
end $$;

-- 4. An unapproved estimate cannot reach production.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DRAFT',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002',
       '99999999-9999-4999-8999-999999999999',
       'Pat Customer','1 Main St','ready',500,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: an unapproved estimate was handed off';
  exception when check_violation then
    raise notice 'Expected unapproved-estimate rejection: %',SQLERRM;
  end;
  if exists (select 1 from public.production_jobs where estimate_id='e1000000-0000-4000-8000-000000000002') then
    raise exception 'SECURITY FAILURE: rejected unapproved handoff still wrote a row';
  end if;
end $$;

-- 5. A job without a recorded acceptance is refused.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NO-ACC',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000006',
       '99999999-9999-4999-8999-999999999999',
       'Pat Customer','1 Main St','ready',1000,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a job was created with no acceptance';
  exception when foreign_key_violation then
    raise notice 'Expected no-acceptance rejection: %',SQLERRM;
  end;
  if exists (select 1 from public.production_jobs where estimate_id='e1000000-0000-4000-8000-000000000006') then
    raise exception 'SECURITY FAILURE: no-acceptance handoff still wrote a row';
  end if;
end $$;

-- 6. The acceptance must belong to the estimate being handed off.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WRONG-ACC',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000001'),
       'Pat Customer','1 Main St','ready',10000,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: an acceptance from another estimate was accepted';
  exception when check_violation then
    raise notice 'Expected acceptance/estimate mismatch rejection: %',SQLERRM;
  end;
end $$;

-- 7. A lost lead cannot be handed off.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LOST',
       '1a000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000003'),
       'Lost Customer','2 Lost Rd','ready',7000,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a lost lead was handed off';
  exception when check_violation then
    raise notice 'Expected lost lead rejection: %',SQLERRM;
  end;
end $$;

-- 8. A zero-dollar or empty scope is not a producible job.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ZERO',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000005',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000005'),
       'Pat Customer','1 Main St','ready',0,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a zero-dollar handoff was accepted';
  exception when check_violation then
    raise notice 'Expected zero-dollar rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EMPTY',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000007',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000007'),
       'Pat Customer','1 Main St','ready',500,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: an empty scope was handed off';
  exception when check_violation then
    raise notice 'Expected empty scope rejection: %',SQLERRM;
  end;
end $$;

-- 9. Cross-workspace handoff is refused and writes nothing.
do $$
begin
  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CROSS',
       '1a000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000004',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000004'),
       'Other Customer','3 Other Ave','ready',7000,now(),1,
       '22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: cross-workspace handoff was accepted';
  exception when check_violation then
    raise notice 'Expected cross-workspace rejection: %',SQLERRM;
  end;
  if exists (select 1 from public.production_jobs where estimate_id='e1000000-0000-4000-8000-000000000004') then
    raise exception 'SECURITY FAILURE: cross-workspace handoff still wrote a row';
  end if;
end $$;

-- 10. Source evidence is immutable; only valid status moves are allowed.
do $$
declare v_job uuid; v_status text;
begin
  select id into v_job from public.production_jobs
   where estimate_id='e1000000-0000-4000-8000-000000000001';

  begin
    update public.production_jobs set accepted_total=1 where id=v_job;
    raise exception 'SECURITY FAILURE: accepted total was updated';
  exception when check_violation then
    raise notice 'Expected accepted-total immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_jobs set approved_scope='[]'::jsonb where id=v_job;
    raise exception 'SECURITY FAILURE: approved scope was updated';
  exception when check_violation then
    raise notice 'Expected scope immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_jobs set job_number='CHANGED' where id=v_job;
    raise exception 'SECURITY FAILURE: job number was updated';
  exception when check_violation then
    raise notice 'Expected job-number immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_jobs set lead_id='1a000000-0000-4000-8000-000000000004' where id=v_job;
    raise exception 'SECURITY FAILURE: lead was updated';
  exception when check_violation then
    raise notice 'Expected lead immutability rejection: %',SQLERRM;
  end;

  update public.production_jobs set status='scheduled' where id=v_job;
  select status into v_status from public.production_jobs where id=v_job;
  if v_status <> 'scheduled' then
    raise exception 'FAILURE: ready -> scheduled was not allowed (got %)',v_status;
  end if;

  begin
    update public.production_jobs set status='completed' where id=v_job;
    raise exception 'SECURITY FAILURE: scheduled -> completed skipped production';
  exception when check_violation then
    raise notice 'Expected invalid status transition rejection: %',SQLERRM;
  end;

  update public.production_jobs set status='in_progress' where id=v_job;
  update public.production_jobs set status='completed' where id=v_job;

  begin
    update public.production_jobs set status='cancelled' where id=v_job;
    raise exception 'SECURITY FAILURE: a completed job was reopened';
  exception when check_violation then
    raise notice 'Expected terminal status rejection: %',SQLERRM;
  end;

  delete from public.production_jobs where id=v_job;
  if exists (select 1 from public.production_jobs where id=v_job) then
    raise notice 'Expected handoff delete to be refused by the absent delete policy';
  else
    raise exception 'SECURITY FAILURE: a production handoff was deleted';
  end if;
end $$;

-- 11. Outsiders neither see nor create workspace jobs.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_jobs
   where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % production jobs',v_count;
  end if;

  begin
    insert into public.production_jobs
      (workspace_id,job_number,lead_id,estimate_id,acceptance_id,
       customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OUTSIDER',
       '1a000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',
       (select id from public.estimate_acceptances where estimate_id='e1000000-0000-4000-8000-000000000001'),
       'Pat Customer','1 Main St','ready',10000,now(),1,
       '33333333-3333-4333-8333-333333333333');
    raise exception 'SECURITY FAILURE: outsider created a production job';
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'Expected RLS/membership rejection for an outsider job: %',SQLERRM;
  end;
end $$;

set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_jobs;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: non-member saw % production jobs',v_count;
  end if;
end $$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_jobs
   where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then
    raise exception 'FAILURE: member should see exactly one job, saw %',v_count;
  end if;
end $$;

reset role;

select 'PASS: approved estimate + recorded acceptance + real priced scope, one immutable job per estimate, server-owned customer/amount/scope, lead won, status-only transitions, workspace and RLS isolation' as result;
