-- Rehearsal: one clean and one exception path through the full production
-- lifecycle, against a disposable GitHub Actions PostgreSQL database.
--
-- This is real SQL/RLS/trigger evidence, not Supabase Auth, Storage, browser,
-- device, or production evidence. Run after migrations 063, 064, 067-074 and
-- after scripts/ci/production-job-assertions.sql (users/workspace exist).
\set ON_ERROR_STOP on

-- Synthetic identities. Idempotent so the file can also run standalone after
-- the baseline and production-job-assertions fixture.
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222')
on conflict do nothing;
insert into public.workspaces(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
on conflict do nothing;
insert into public.workspace_members(workspace_id,user_id,role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','member')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- Clean path, step 1: customer, approved priced estimate, recorded acceptance.
insert into public.leads(id,workspace_id,owner_id,name,address,status)
values
  ('1a000000-0000-4000-8000-000000000101','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111','Lifecycle Customer','10 Rehearsal Way','report_approved');

insert into public.estimates
  (id,workspace_id,lead_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at)
values
  ('e4000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1a000000-0000-4000-8000-000000000101','approved','v1',1000,100,1100,
   '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());

insert into public.estimate_line_items
  (id,estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot)
values
  ('14000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001',
   'SHN-40','Architectural shingles','material','square',1,700,700,'{"source":"price_book"}'),
  ('14000000-0000-4000-8000-000000000002','e4000000-0000-4000-8000-000000000001',
   'LAB-INST','Install shingles','labor','hour',1,300,300,'{"source":"price_book"}');

insert into public.estimate_acceptances
  (id,workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
  ('ac400000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'e4000000-0000-4000-8000-000000000001','Lifecycle Customer','phone',
   '11111111-1111-4111-8111-111111111111');

-- Clean path, step 2: handoff creates one ready job with a server-owned snapshot.
insert into public.production_jobs
  (id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('1e000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PENDING',
   '1a000000-0000-4000-8000-000000000101','e4000000-0000-4000-8000-000000000001',
   'ac400000-0000-4000-8000-000000000001','forged','forged','completed',1,'2000-01-01 00:00:00+00',
   'forged','[]',1,'11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_jobs%rowtype;
declare v_lead_status text;
begin
  select * into v from public.production_jobs where id='1e000000-0000-4000-8000-000000000001';
  if v.status <> 'ready' then
    raise exception 'LIFECYCLE FAILURE: handoff did not start ready (got %)',v.status;
  end if;
  if v.accepted_total <> 1100 or v.scope_item_count <> 2 then
    raise exception 'LIFECYCLE FAILURE: handoff snapshot is wrong (%, %)',v.accepted_total,v.scope_item_count;
  end if;
  if v.customer_name <> 'Lifecycle Customer' or v.property_address <> '10 Rehearsal Way' then
    raise exception 'LIFECYCLE FAILURE: handoff did not copy the customer (%, %)',v.customer_name,v.property_address;
  end if;
  if v.job_number !~ '^JOB-[0-9A-F]{12}$' then
    raise exception 'LIFECYCLE FAILURE: job number is not server generated (got %)',v.job_number;
  end if;
  select status into v_lead_status from public.leads where id='1a000000-0000-4000-8000-000000000101';
  if v_lead_status <> 'won' then
    raise exception 'LIFECYCLE FAILURE: the lead did not become won (got %)',v_lead_status;
  end if;
end $$;

-- Clean path, step 3: schedule and prebuild readiness (owner writes).
insert into public.production_job_assignments
  (workspace_id,job_id,member_user_id,role,scheduled_start,scheduled_end,created_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222','crew',now()+interval '1 day',now()+interval '2 days',
   '11111111-1111-4111-8111-111111111111');

insert into public.production_job_materials
  (workspace_id,job_id,line_item_id,description,quantity,unit,created_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   '14000000-0000-4000-8000-000000000001','Architectural shingles',1,'square',
   '11111111-1111-4111-8111-111111111111');

insert into public.production_job_readiness
  (workspace_id,job_id,permit_status,permit_reference,weather_decision,weather_source)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   'issued','PERMIT-REHEARSAL-1','clear','NWS point forecast');

do $$
declare v public.production_job_readiness%rowtype;
begin
  select * into v from public.production_job_readiness where job_id='1e000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'LIFECYCLE FAILURE: readiness row was not recorded';
  end if;
  if v.permit_checked_by <> '11111111-1111-4111-8111-111111111111'::uuid
     or v.permit_checked_at is null then
    raise exception 'LIFECYCLE FAILURE: permit check was not server stamped';
  end if;
  if v.weather_checked_by <> '11111111-1111-4111-8111-111111111111'::uuid
     or v.weather_checked_at is null then
    raise exception 'LIFECYCLE FAILURE: weather check was not server stamped';
  end if;
end $$;

-- Clean path, step 4: field evidence and an owner-approved change order.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.production_job_updates(workspace_id,job_id,work_date,note,percent_complete,blockers)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   current_date,'Tear-off complete; deck inspected',40,'');

insert into public.production_job_change_orders(workspace_id,job_id,requested_by,description,amount_delta)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222','Add ridge ventilation',50);

do $$
declare v public.production_job_updates%rowtype;
begin
  select * into v from public.production_job_updates where job_id='1e000000-0000-4000-8000-000000000001';
  if v.created_by <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'LIFECYCLE FAILURE: field author was not server stamped';
  end if;
end $$;

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.production_job_change_orders
   set status='approved'
 where job_id='1e000000-0000-4000-8000-000000000001';

-- Clean path, step 5: work starts. A critical defect blocks closeout and completion.
update public.production_jobs
   set status='in_progress'
 where id='1e000000-0000-4000-8000-000000000001';

insert into public.production_job_punch_items
  (id,workspace_id,job_id,severity,location,description,created_by)
values
  ('24000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1e000000-0000-4000-8000-000000000001','critical','North slope',
   'Exposed fastener not sealed','11111111-1111-4111-8111-111111111111');

-- Exception path A: completion before supervisor closeout is refused.
do $$
begin
  begin
    update public.production_jobs set status='completed'
     where id='1e000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a job completed without a closeout';
  exception when check_violation then
    raise notice 'Expected completion-without-closeout rejection: %',SQLERRM;
  end;
  if (select status from public.production_jobs where id='1e000000-0000-4000-8000-000000000001') <> 'in_progress' then
    raise exception 'EXCEPTION FAILURE: the refused completion changed the job status';
  end if;
end $$;

-- Exception path B: closeout with an open critical item is refused.
do $$
begin
  begin
    insert into public.production_job_closeouts(workspace_id,job_id,closed_by,note)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
       '11111111-1111-4111-8111-111111111111','Ready for closeout');
    raise exception 'EXCEPTION FAILURE: closeout accepted an open critical item';
  exception when check_violation then
    raise notice 'Expected critical-item closeout rejection: %',SQLERRM;
  end;
end $$;

-- Resolve it, then close out and complete.
update public.production_job_punch_items
   set status='resolved', resolution_note='Fastener sealed and re-inspected'
 where id='24000000-0000-4000-8000-000000000001';

insert into public.production_job_closeouts(workspace_id,job_id,closed_by,note)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111','Supervisor walk complete');

do $$
declare v public.production_job_closeouts%rowtype;
begin
  select * into v from public.production_job_closeouts where job_id='1e000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'LIFECYCLE FAILURE: closeout was not recorded';
  end if;
  if v.closed_by <> '11111111-1111-4111-8111-111111111111'::uuid
     or v.open_critical_count <> 0 or v.open_total_count <> 0 then
    raise exception 'LIFECYCLE FAILURE: closeout evidence is wrong (% / % / %)',
      v.closed_by,v.open_critical_count,v.open_total_count;
  end if;
end $$;

-- Exception path C: a defect recorded after closeout still blocks completion.
insert into public.production_job_punch_items
  (id,workspace_id,job_id,severity,location,description,created_by)
values
  ('24000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1e000000-0000-4000-8000-000000000001','critical','South slope',
   'Ridge cap not seated','11111111-1111-4111-8111-111111111111');

do $$
begin
  begin
    update public.production_jobs set status='completed'
     where id='1e000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a post-closeout critical item did not block completion';
  exception when check_violation then
    raise notice 'Expected post-closeout critical-item completion rejection: %',SQLERRM;
  end;
end $$;

update public.production_job_punch_items
   set status='resolved', resolution_note='Ridge cap reseated'
 where id='24000000-0000-4000-8000-000000000002';

update public.production_jobs set status='completed'
 where id='1e000000-0000-4000-8000-000000000001';

-- Clean path, step 6: invoice from the approved scope, tax, and change order.
insert into public.production_invoices(id,workspace_id,job_id,acceptance_id,created_by)
values
  ('25000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1e000000-0000-4000-8000-000000000001','ac400000-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_invoices%rowtype;
begin
  select * into v from public.production_invoices where id='25000000-0000-4000-8000-000000000001';
  if v.status <> 'draft' then
    raise exception 'LIFECYCLE FAILURE: invoice did not start draft (got %)',v.status;
  end if;
  if v.source_accepted_total <> 1100 or v.source_tax <> 100 then
    raise exception 'LIFECYCLE FAILURE: accepted snapshot is wrong (%, %)',v.source_accepted_total,v.source_tax;
  end if;
  if v.scope_lines_total <> 1000 or v.change_order_total <> 50 then
    raise exception 'LIFECYCLE FAILURE: scope or change order total is wrong (%, %)',v.scope_lines_total,v.change_order_total;
  end if;
  if v.subtotal <> 1050 or v.tax <> 100 or v.total <> 1150 then
    raise exception 'LIFECYCLE FAILURE: invoice totals are wrong (%, %, %)',v.subtotal,v.tax,v.total;
  end if;
  if v.deposit_credit <> 0 or v.balance_due <> 1150 then
    raise exception 'LIFECYCLE FAILURE: balance is wrong (%, %)',v.deposit_credit,v.balance_due;
  end if;
  if jsonb_array_length(v.line_items) <> 3 then
    raise exception 'LIFECYCLE FAILURE: expected 3 invoice lines, got %',jsonb_array_length(v.line_items);
  end if;
end $$;

-- Exception path D: a payment cannot attach to a draft invoice.
do $$
begin
  begin
    insert into public.production_invoice_payments
      (workspace_id,invoice_id,amount_cents,payment_method,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','25000000-0000-4000-8000-000000000001',
       115000,'manual','11111111-1111-4111-8111-111111111111');
    raise exception 'EXCEPTION FAILURE: a draft invoice took a payment attempt';
  exception when check_violation then
    raise notice 'Expected draft-invoice payment rejection: %',SQLERRM;
  end;
end $$;

update public.production_invoices set status='issued'
 where id='25000000-0000-4000-8000-000000000001';

-- Exception path E: at most one live invoice per job.
do $$
begin
  begin
    insert into public.production_invoices(workspace_id,job_id,acceptance_id,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
       'ac400000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111');
    raise exception 'EXCEPTION FAILURE: a second live invoice was created';
  exception when unique_violation then
    raise notice 'Expected one-live-invoice rejection: %',SQLERRM;
  end;
end $$;

-- Clean path, step 7: pending -> succeeded payment; no invoice mutation.
insert into public.production_invoice_payments
  (id,workspace_id,invoice_id,amount_cents,payment_method,receipt_reference,created_by)
values
  ('26000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '25000000-0000-4000-8000-000000000001',115000,'manual','CHECK-REHEARSAL-1',
   '11111111-1111-4111-8111-111111111111');

-- Exception path F: pending cannot jump straight to reversed.
do $$
begin
  begin
    update public.production_invoice_payments set status='reversed'
     where id='26000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a pending payment was reversed directly';
  exception when check_violation then
    raise notice 'Expected pending-to-reversed rejection: %',SQLERRM;
  end;
end $$;

update public.production_invoice_payments set status='succeeded'
 where id='26000000-0000-4000-8000-000000000001';

do $$
declare v_payment public.production_invoice_payments%rowtype;
declare v_invoice public.production_invoices%rowtype;
begin
  select * into v_payment from public.production_invoice_payments where id='26000000-0000-4000-8000-000000000001';
  if v_payment.status <> 'succeeded' or v_payment.completed_at is null then
    raise exception 'LIFECYCLE FAILURE: the payment did not complete (%, %)',v_payment.status,v_payment.completed_at;
  end if;
  if v_payment.created_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'LIFECYCLE FAILURE: the payment author was not server stamped';
  end if;
  select * into v_invoice from public.production_invoices where id='25000000-0000-4000-8000-000000000001';
  if v_invoice.status <> 'issued' or v_invoice.total <> 1150 or v_invoice.balance_due <> 1150 then
    raise exception 'LIFECYCLE FAILURE: the payment changed the invoice (% / % / %)',
      v_invoice.status,v_invoice.total,v_invoice.balance_due;
  end if;
end $$;

-- Exception path G: an invoice with a successful payment cannot be voided.
do $$
begin
  begin
    update public.production_invoices set status='void', void_reason='Duplicate'
     where id='25000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a paid invoice was voided';
  exception when check_violation then
    raise notice 'Expected paid-invoice void rejection: %',SQLERRM;
  end;
end $$;

-- Clean path, step 8: reverse the payment, then void the invoice.
update public.production_invoice_payments set status='reversed'
 where id='26000000-0000-4000-8000-000000000001';
update public.production_invoices set status='void', void_reason='Rehearsal replacement'
 where id='25000000-0000-4000-8000-000000000001';

do $$
declare v public.production_invoices%rowtype;
begin
  select * into v from public.production_invoices where id='25000000-0000-4000-8000-000000000001';
  if v.status <> 'void' or v.voided_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'LIFECYCLE FAILURE: the invoice was not voided with stamped evidence';
  end if;
end $$;

-- Exception path H: a void invoice cannot take a new payment attempt.
do $$
begin
  begin
    insert into public.production_invoice_payments
      (workspace_id,invoice_id,amount_cents,payment_method,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','25000000-0000-4000-8000-000000000001',
       100,'manual','11111111-1111-4111-8111-111111111111');
    raise exception 'EXCEPTION FAILURE: a void invoice took a payment attempt';
  exception when check_violation then
    raise notice 'Expected void-invoice payment rejection: %',SQLERRM;
  end;
end $$;

-- Clean path, step 9: warranty and Roof Passport for the completed job.
insert into public.warranties
  (workspace_id,job_id,issued_at,expires_at,terms,issued_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
   '2000-01-01 00:00:00+00','2000-01-01 00:00:00+00','One-year limited workmanship warranty',
   '22222222-2222-4222-8222-222222222222');

do $$
declare v public.warranties%rowtype;
begin
  select * into v from public.warranties where job_id='1e000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'LIFECYCLE FAILURE: warranty was not recorded';
  end if;
  if v.status <> 'active' then
    raise exception 'LIFECYCLE FAILURE: warranty did not start active (got %)',v.status;
  end if;
  if v.issued_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'LIFECYCLE FAILURE: warranty issuer was not server stamped';
  end if;
  if v.issued_at < now() - interval '1 minute'
     or v.expires_at < now() + interval '11 months' then
    raise exception 'LIFECYCLE FAILURE: warranty term was not server computed (%, %)',v.issued_at,v.expires_at;
  end if;
end $$;

-- Exception path I: one warranty per job.
do $$
begin
  begin
    insert into public.warranties(workspace_id,job_id,terms,issued_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1e000000-0000-4000-8000-000000000001',
       'Duplicate','11111111-1111-4111-8111-111111111111');
    raise exception 'EXCEPTION FAILURE: a second warranty was recorded for one job';
  exception when unique_violation then
    raise notice 'Expected one-warranty-per-job rejection: %',SQLERRM;
  end;
end $$;

-- Exception path J: a warranty needs a completed job and a revoke is terminal.
do $$
begin
  begin
    insert into public.warranties(workspace_id,job_id,terms,issued_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1d000000-0000-4000-8000-000000000001',
       'Not completed','11111111-1111-4111-8111-111111111111');
    raise exception 'EXCEPTION FAILURE: a warranty was issued for an incomplete job';
  exception when check_violation then
    raise notice 'Expected incomplete-job warranty rejection: %',SQLERRM;
  end;
end $$;

update public.warranties set status='expired'
 where job_id='1e000000-0000-4000-8000-000000000001';
update public.warranties set status='revoked'
 where job_id='1e000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    update public.warranties set status='active'
     where job_id='1e000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a revoked warranty was reactivated';
  exception when check_violation then
    raise notice 'Expected revoked-warranty immutability: %',SQLERRM;
  end;
end $$;

insert into public.roof_passports(id,workspace_id,job_id,version,data,status)
values
  ('27000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1e000000-0000-4000-8000-000000000001','1.0',
   '[{"kind":"scope","source":"approved_estimate"},{"kind":"qc","source":"closeout"}]'::jsonb,
   'issued');

do $$
declare v public.roof_passports%rowtype;
begin
  select * into v from public.roof_passports where id='27000000-0000-4000-8000-000000000001';
  if v.status <> 'pending' then
    raise exception 'LIFECYCLE FAILURE: a passport did not start pending (got %)',v.status;
  end if;
  if v.generated_at is null then
    raise exception 'LIFECYCLE FAILURE: passport generation time was not stamped';
  end if;
end $$;

update public.roof_passports set status='generated'
 where id='27000000-0000-4000-8000-000000000001';
update public.roof_passports set status='issued'
 where id='27000000-0000-4000-8000-000000000001';

-- Exception path K: revocation needs a reason and is terminal.
do $$
begin
  begin
    update public.roof_passports set status='revoked'
     where id='27000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a passport was revoked without a reason';
  exception when check_violation then
    raise notice 'Expected reasonless-passport-revocation rejection: %',SQLERRM;
  end;
end $$;

update public.roof_passports
   set status='revoked', revocation_reason='Superseded by corrected passport'
 where id='27000000-0000-4000-8000-000000000001';

do $$
declare v public.roof_passports%rowtype;
begin
  select * into v from public.roof_passports where id='27000000-0000-4000-8000-000000000001';
  if v.status <> 'revoked'
     or v.revoked_by <> '11111111-1111-4111-8111-111111111111'::uuid
     or v.revoked_at is null then
    raise exception 'LIFECYCLE FAILURE: passport revocation evidence is incomplete';
  end if;
  begin
    update public.roof_passports set status='pending'
     where id='27000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a revoked passport was reopened';
  exception when check_violation then
    raise notice 'Expected passport-revocation immutability: %',SQLERRM;
  end;
end $$;

-- Deletes are refused even for a caller that bypasses RLS.
reset role;
do $$
begin
  begin
    delete from public.production_invoice_payments where id='26000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a payment attempt was deleted';
  exception when check_violation then
    raise notice 'Expected payment delete rejection: %',SQLERRM;
  end;
  begin
    delete from public.warranties where job_id='1e000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a warranty was deleted';
  exception when check_violation then
    raise notice 'Expected warranty delete rejection: %',SQLERRM;
  end;
  begin
    delete from public.roof_passports where id='27000000-0000-4000-8000-000000000001';
    raise exception 'EXCEPTION FAILURE: a Roof Passport was deleted';
  exception when check_violation then
    raise notice 'Expected passport delete rejection: %',SQLERRM;
  end;
end $$;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- The member sees the completed job history and cannot see another workspace.
do $$
declare v_job public.production_jobs%rowtype;
begin
  select * into v_job from public.production_jobs where id='1e000000-0000-4000-8000-000000000001';
  if v_job.status <> 'completed' then
    raise exception 'LIFECYCLE FAILURE: the completed job is not visible to a member';
  end if;
  if v_job.accepted_total <> 1100 or v_job.scope_item_count <> 2 then
    raise exception 'LIFECYCLE FAILURE: lifecycle evidence rewrote the handoff snapshot';
  end if;
  if (select count(*) from public.production_invoices
       where job_id='1e000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'LIFECYCLE FAILURE: a member did not see exactly the rehearsed invoice';
  end if;
end $$;

select 'PASS: clean path (lead -> estimate -> acceptance -> job -> schedule/readiness -> field/change order -> QC/closeout -> completed -> invoice -> payment -> warranty/passport) and exception path (completion gate, critical punch, draft/void payment, one live invoice, one warranty, terminal revocation) in disposable PostgreSQL' as result;
