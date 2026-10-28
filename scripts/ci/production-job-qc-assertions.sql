-- Run only after migrations 063, 064, 067, 068, 069 and 070 are applied.
-- Creates its own job so the completion gate is exercised end to end.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- Setup: one approved estimate with a priced line, one recorded acceptance, one job.
insert into public.estimates
  (id,workspace_id,lead_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at)
values
  ('e2000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1a000000-0000-4000-8000-000000000001','approved','v1',600,0,600,
   '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());

insert into public.estimate_line_items
  (id,estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot)
values
  ('12000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',
   'SHN-30','Architectural shingles','material','square',1,600,600,'{"source":"price_book","sku":"SHN-30"}');

insert into public.estimate_acceptances
  (id,workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
  ('ac200000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'e2000000-0000-4000-8000-000000000001','Pat Customer','phone',
   '11111111-1111-4111-8111-111111111111');

insert into public.production_jobs
  (id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('1c000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QC-JOB',
   '1a000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',
   'ac200000-0000-4000-8000-000000000001','Fake','Fake','completed',1,'2000-01-01 00:00:00+00',
   'forged','[]',1,'11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_jobs%rowtype;
begin
  select * into v from public.production_jobs where id='1c000000-0000-4000-8000-000000000001';
  if v.status <> 'ready' then
    raise exception 'FAILURE: the QC job did not start ready (got %)',v.status;
  end if;
  if v.accepted_total <> 600 or v.scope_item_count <> 1 then
    raise exception 'FAILURE: the QC job snapshot is wrong (%, %)',v.accepted_total,v.scope_item_count;
  end if;
end $$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
update public.production_jobs set status='scheduled'
 where id='1c000000-0000-4000-8000-000000000001';
update public.production_jobs set status='in_progress'
 where id='1c000000-0000-4000-8000-000000000001';

-- 1. A member records a critical defect. A forged resolution is ignored.
insert into public.production_job_punch_items
  (id,workspace_id,job_id,severity,location,description,status,
   created_by,resolved_by,resolved_at,resolution_note)
values
  ('20000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1c000000-0000-4000-8000-000000000001','critical','North slope',
   'Missing step flashing at the wall','resolved',
   '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now(),'forged');

do $$
declare v public.production_job_punch_items%rowtype;
begin
  select * into v from public.production_job_punch_items
   where id='20000000-0000-4000-8000-000000000001';
  if v.status <> 'open' then
    raise exception 'FAILURE: a new punch item must start open (got %)',v.status;
  end if;
  if v.created_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: the punch author was not stamped from the caller';
  end if;
  if v.resolved_by is not null or v.resolved_at is not null or v.resolution_note <> '' then
    raise exception 'FAILURE: a new punch item carried a forged resolution';
  end if;
end $$;

-- 2. A plain member cannot record the supervisor closeout.
do $$
begin
  begin
    insert into public.production_job_closeouts
      (workspace_id,job_id,closed_by,note,open_critical_count,open_total_count)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
       '22222222-2222-4222-8222-222222222222','member closeout',0,0);
    raise exception 'SECURITY FAILURE: a plain member recorded a closeout';
  exception when insufficient_privilege then
    raise notice 'Expected member closeout denial: %',SQLERRM;
  end;
end $$;

-- 3. Completion is refused while no closeout exists.
do $$
begin
  begin
    update public.production_jobs set status='completed'
     where id='1c000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: a job completed without a supervisor closeout';
  exception when check_violation then
    raise notice 'Expected missing-closeout rejection: %',SQLERRM;
  end;
end $$;

-- 4. The owner cannot close out while a critical item is open.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
begin
  begin
    insert into public.production_job_closeouts
      (workspace_id,job_id,closed_by,note,open_critical_count,open_total_count)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
       '11111111-1111-4111-8111-111111111111','premature closeout',0,0);
    raise exception 'SECURITY FAILURE: closeout succeeded with an open critical item';
  exception when check_violation then
    raise notice 'Expected open-critical closeout rejection: %',SQLERRM;
  end;
end $$;

-- 5. A member resolves the critical item. The database stamps the resolver.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
update public.production_job_punch_items
   set status='resolved', resolution_note='Flashing installed and sealed'
 where id='20000000-0000-4000-8000-000000000001';

do $$
declare v public.production_job_punch_items%rowtype;
begin
  select * into v from public.production_job_punch_items
   where id='20000000-0000-4000-8000-000000000001';
  if v.status <> 'resolved' then
    raise exception 'FAILURE: the punch resolution was not stored (got %)',v.status;
  end if;
  if v.resolved_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: the resolver was not stamped from the caller';
  end if;
  if v.resolved_at is null then
    raise exception 'FAILURE: the resolution time was not stamped';
  end if;
  if v.resolution_note <> 'Flashing installed and sealed' then
    raise exception 'FAILURE: the resolution note was not stored';
  end if;
end $$;

-- 6. A resolved item is immutable, and it cannot be reopened or re-resolved.
do $$
begin
  begin
    update public.production_job_punch_items
       set description='rewritten defect'
     where id='20000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: a resolved punch item was edited';
  exception when check_violation then
    raise notice 'Expected resolved-item immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_job_punch_items
       set status='open'
     where id='20000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: a resolved punch item was reopened';
  exception when check_violation then
    raise notice 'Expected reopen rejection: %',SQLERRM;
  end;

  begin
    update public.production_job_punch_items
       set status='resolved', resolution_note='second resolution'
     where id='20000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: a resolved punch item was resolved twice';
  exception when check_violation then
    raise notice 'Expected re-resolution rejection: %',SQLERRM;
  end;
end $$;

-- 7. A member cannot delete a punch item; no delete policy means zero rows.
delete from public.production_job_punch_items
 where id='20000000-0000-4000-8000-000000000001';
do $$
begin
  if not exists (select 1 from public.production_job_punch_items
                  where id='20000000-0000-4000-8000-000000000001') then
    raise exception 'SECURITY FAILURE: a punch item was deleted';
  end if;
end $$;

-- 8. A second critical item still blocks the closeout; a minor item does not.
insert into public.production_job_punch_items
  (workspace_id,job_id,severity,location,description)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
   'critical','Ridge','Exposed nail heads on the ridge cap'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
   'minor','Yard','Two shingle wrappers left in the yard');

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
begin
  begin
    insert into public.production_job_closeouts
      (workspace_id,job_id,closed_by,note,open_critical_count,open_total_count)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
       '11111111-1111-4111-8111-111111111111','second attempt',0,0);
    raise exception 'SECURITY FAILURE: closeout succeeded with a second open critical item';
  exception when check_violation then
    raise notice 'Expected second open-critical closeout rejection: %',SQLERRM;
  end;
end $$;

-- 9. The owner closeout succeeds once the critical items are resolved. The open
--    minor item is recorded in the snapshot but does not block.
update public.production_job_punch_items
   set status='resolved', resolution_note='Ridge cap nails reset and sealed'
 where description='Exposed nail heads on the ridge cap';

insert into public.production_job_closeouts
  (id,workspace_id,job_id,closed_by,note,open_critical_count,open_total_count)
values
  ('2a000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1c000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',
   'Supervisor walk complete',99,99);

do $$
declare v public.production_job_closeouts%rowtype;
begin
  select * into v from public.production_job_closeouts
   where id='2a000000-0000-4000-8000-000000000001';
  if v.closed_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: the closeout supervisor was not stamped from the caller';
  end if;
  if v.closed_at is null then
    raise exception 'FAILURE: the closeout time was not stamped';
  end if;
  if v.open_critical_count <> 0 then
    raise exception 'FAILURE: the closeout critical count was not recomputed (got %)',v.open_critical_count;
  end if;
  if v.open_total_count <> 1 then
    raise exception 'FAILURE: the closeout open count was not recomputed (got %)',v.open_total_count;
  end if;
  if v.note <> 'Supervisor walk complete' then
    raise exception 'FAILURE: the closeout note was not stored';
  end if;
end $$;

-- 10. The closeout is one per job and immutable.
do $$
begin
  begin
    insert into public.production_job_closeouts
      (workspace_id,job_id,closed_by,open_critical_count,open_total_count)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
       '11111111-1111-4111-8111-111111111111',0,0);
    raise exception 'SECURITY FAILURE: a second closeout was accepted for one job';
  exception when unique_violation then
    raise notice 'Expected one-closeout-per-job rejection: %',SQLERRM;
  end;
end $$;

update public.production_job_closeouts
   set note='rewritten closeout'
 where id='2a000000-0000-4000-8000-000000000001';

delete from public.production_job_closeouts
 where id='2a000000-0000-4000-8000-000000000001';

do $$
declare v_note text;
begin
  select note into v_note from public.production_job_closeouts
   where id='2a000000-0000-4000-8000-000000000001';
  if v_note is distinct from 'Supervisor walk complete' then
    raise exception 'SECURITY FAILURE: a closeout was rewritten (%)',v_note;
  end if;
end $$;

-- 11. A defect recorded after closeout still blocks completion.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.production_job_punch_items
  (workspace_id,job_id,severity,location,description)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
   'critical','Garage','Garage transition is not flashed');

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
begin
  begin
    update public.production_jobs set status='completed'
     where id='1c000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: a post-closeout critical item did not block completion';
  exception when check_violation then
    raise notice 'Expected post-closeout critical rejection: %',SQLERRM;
  end;
end $$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
update public.production_job_punch_items
   set status='resolved', resolution_note='Garage transition flashed'
 where description='Garage transition is not flashed';

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.production_jobs set status='completed'
 where id='1c000000-0000-4000-8000-000000000001';

-- 12. A completed job refuses new punch items and resolutions.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
begin
  begin
    insert into public.production_job_punch_items
      (workspace_id,job_id,severity,description)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1c000000-0000-4000-8000-000000000001',
       'minor','Late defect');
    raise exception 'SECURITY FAILURE: a completed job took a new punch item';
  exception when check_violation then
    raise notice 'Expected completed-job punch rejection: %',SQLERRM;
  end;

  begin
    update public.production_job_punch_items
       set status='resolved', resolution_note='late resolution'
     where description='Two shingle wrappers left in the yard';
    raise exception 'SECURITY FAILURE: a completed job resolved a punch item';
  exception when check_violation then
    raise notice 'Expected completed-job resolution rejection: %',SQLERRM;
  end;
end $$;

-- 13. Another workspace cannot read or write either record.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_job_punch_items;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % punch items',v_count;
  end if;
  select count(*) into v_count from public.production_job_closeouts;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % closeouts',v_count;
  end if;

  begin
    insert into public.production_job_punch_items
      (workspace_id,job_id,severity,description)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1c000000-0000-4000-8000-000000000001',
       'critical','outsider defect');
    raise exception 'SECURITY FAILURE: another workspace added a punch item';
  exception when check_violation then
    raise notice 'Expected cross-workspace punch rejection: %',SQLERRM;
  end;

  begin
    insert into public.production_job_closeouts
      (workspace_id,job_id,closed_by,open_critical_count,open_total_count)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1c000000-0000-4000-8000-000000000001',
       '33333333-3333-4333-8333-333333333333',0,0);
    raise exception 'SECURITY FAILURE: another workspace recorded a closeout';
  exception when check_violation then
    raise notice 'Expected cross-workspace closeout rejection: %',SQLERRM;
  end;
end $$;

-- 14. The triggers refuse edit and delete even for a caller that bypasses RLS.
reset role;

do $$
begin
  begin
    update public.production_job_punch_items
       set resolution_note='superuser rewrite'
     where id='20000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the punch trigger allowed an edit';
  exception when check_violation then
    raise notice 'Expected punch immutability trigger: %',SQLERRM;
  end;

  begin
    delete from public.production_job_punch_items
     where id='20000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the punch trigger allowed a delete';
  exception when check_violation then
    raise notice 'Expected punch delete trigger: %',SQLERRM;
  end;

  begin
    update public.production_job_closeouts
       set note='superuser rewrite'
     where id='2a000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the closeout trigger allowed an edit';
  exception when check_violation then
    raise notice 'Expected closeout immutability trigger: %',SQLERRM;
  end;

  begin
    delete from public.production_job_closeouts
     where id='2a000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the closeout trigger allowed a delete';
  exception when check_violation then
    raise notice 'Expected closeout delete trigger: %',SQLERRM;
  end;
end $$;

-- 15. The handoff snapshot is untouched by QC evidence.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare v public.production_jobs%rowtype;
begin
  select * into v from public.production_jobs
   where id='1c000000-0000-4000-8000-000000000001';
  if v.status <> 'completed' then
    raise exception 'FAILURE: the job did not complete after closeout (got %)',v.status;
  end if;
  if v.accepted_total <> 600 or v.scope_item_count <> 1 then
    raise exception 'FAILURE: QC evidence changed the handoff amount or scope';
  end if;
  if v.customer_name <> 'Pat Customer' or v.property_address <> '1 Main St' then
    raise exception 'FAILURE: QC evidence changed the customer snapshot';
  end if;
end $$;

select 'PASS: member punch write, server-stamped author and resolver, resolved-item immutability, no reopen, no delete, member closeout denial, open-critical closeout block, owner-only stamped closeout, open minor recorded, one closeout per job, immutable closeout, post-closeout critical block, completion gate, completed-job refusal, cross-workspace denial, handoff snapshot unchanged' as result;
