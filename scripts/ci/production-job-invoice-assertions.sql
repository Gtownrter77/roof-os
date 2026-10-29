-- Run only after migrations 063, 064, 067, 068, 069, 070 and 071 are applied.
-- Creates its own job so the invoice snapshot is exercised end to end.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- Setup: approved estimate with tax, priced scope, acceptance, job.
insert into public.estimates
  (id,workspace_id,lead_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at)
values
  ('e3000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1a000000-0000-4000-8000-000000000001','approved','v1',450,50,500,
   '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());

insert into public.estimate_line_items
  (id,estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot)
values
  ('13000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
   'SHN-30','Architectural shingles','material','square',1,300,300,'{"source":"price_book","sku":"SHN-30"}'),
  ('13000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000001',
   'LAB-INST','Install shingles','labor','hour',1,150,150,'{"source":"price_book","sku":"LAB-INST"}');

insert into public.estimate_acceptances
  (id,workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
  ('ac300000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'e3000000-0000-4000-8000-000000000001','Pat Customer','phone',
   '11111111-1111-4111-8111-111111111111');

insert into public.production_jobs
  (id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('1d000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','INVOICE-JOB',
   '1a000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
   'ac300000-0000-4000-8000-000000000001','Fake','Fake','completed',1,'2000-01-01 00:00:00+00',
   'forged','[]',1,'11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_jobs%rowtype;
begin
  select * into v from public.production_jobs where id='1d000000-0000-4000-8000-000000000001';
  if v.status <> 'ready' then
    raise exception 'FAILURE: the invoice job did not start ready (got %)',v.status;
  end if;
  if v.accepted_total <> 500 or v.scope_item_count <> 2 then
    raise exception 'FAILURE: the invoice job snapshot is wrong (%, %)',v.accepted_total,v.scope_item_count;
  end if;
end $$;

-- Approved, declined and pending change orders.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.production_job_change_orders
  (id,workspace_id,job_id,requested_by,description,amount_delta)
values
  ('21000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1d000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',
   'Add ridge ventilation',75),
  ('21000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1d000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',
   'Replace gutter (declined)',30),
  ('21000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1d000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',
   'Add skylight (pending)',20);

-- Deposit requested and received. The invoice credits only what was received.
insert into public.estimate_deposit_events
  (workspace_id,estimate_id,acceptance_id,event_type,amount,recorded_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e3000000-0000-4000-8000-000000000001',
   'ac300000-0000-4000-8000-000000000001','requested',100,
   '22222222-2222-4222-8222-222222222222');

insert into public.estimate_deposit_events
  (workspace_id,estimate_id,acceptance_id,event_type,amount,method,recorded_by)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e3000000-0000-4000-8000-000000000001',
   'ac300000-0000-4000-8000-000000000001','received',100,'check',
   '22222222-2222-4222-8222-222222222222');

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.production_job_change_orders
   set status='approved'
 where id='21000000-0000-4000-8000-000000000001';
update public.production_job_change_orders
   set status='declined'
 where id='21000000-0000-4000-8000-000000000002';

-- 1. A plain member cannot create an invoice.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
begin
  begin
    insert into public.production_invoices(workspace_id,job_id,acceptance_id,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1d000000-0000-4000-8000-000000000001',
       'ac300000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222');
    raise exception 'SECURITY FAILURE: a plain member created an invoice';
  exception when insufficient_privilege then
    raise notice 'Expected member invoice denial: %',SQLERRM;
  end;
end $$;

-- 2. The owner creates a draft. Every amount is computed by the database.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.production_invoices(id,workspace_id,job_id,acceptance_id,created_by)
values
  ('22000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1d000000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111');

do $$
declare v public.production_invoices%rowtype;
begin
  select * into v from public.production_invoices
   where id='22000000-0000-4000-8000-000000000001';
  if v.invoice_number not like 'INV-%' then
    raise exception 'FAILURE: the invoice number was client supplied (got %)',v.invoice_number;
  end if;
  if v.status <> 'draft' then
    raise exception 'FAILURE: a new invoice must start draft (got %)',v.status;
  end if;
  if v.source_accepted_total <> 500 or v.source_tax <> 50 then
    raise exception 'FAILURE: the accepted snapshot is wrong (%, %)',v.source_accepted_total,v.source_tax;
  end if;
  if v.scope_lines_total <> 450 or v.change_order_total <> 75 then
    raise exception 'FAILURE: scope or change-order total is wrong (%, %)',v.scope_lines_total,v.change_order_total;
  end if;
  if v.subtotal <> 525 or v.tax <> 50 or v.total <> 575 then
    raise exception 'FAILURE: invoice totals are wrong (%, %, %)',v.subtotal,v.tax,v.total;
  end if;
  if v.deposit_credit <> 100 or v.balance_due <> 475 then
    raise exception 'FAILURE: deposit credit is wrong (%, %)',v.deposit_credit,v.balance_due;
  end if;
  if v.scope_item_count <> 2 then
    raise exception 'FAILURE: scope count is wrong (got %)',v.scope_item_count;
  end if;
  if jsonb_array_length(v.line_items) <> 3 then
    raise exception 'FAILURE: expected two scope lines and one approved change order, got %',jsonb_array_length(v.line_items);
  end if;
  if v.line_items @> '[{"kind":"change_order","line_total":75}]'::jsonb is not true then
    raise exception 'FAILURE: the approved change order is missing from the invoice lines';
  end if;
  if v.line_items @> '[{"kind":"change_order","line_total":30}]'::jsonb
     or v.line_items @> '[{"kind":"change_order","line_total":20}]'::jsonb then
    raise exception 'FAILURE: a declined or pending change order was invoiced';
  end if;
  if v.issued_at is not null or v.voided_at is not null then
    raise exception 'FAILURE: a draft invoice carried issued or void evidence';
  end if;
end $$;

-- 3. A plain member cannot issue or void. RLS may reject the update by
-- filtering out the row (UPDATE 0) rather than raising insufficient_privilege.
-- Both outcomes are valid, but the invoice must remain a draft.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $
declare v_updated integer := 0;
declare v_status text;
begin
  begin
    update public.production_invoices set status='issued'
     where id='22000000-0000-4000-8000-000000000001';
    get diagnostics v_updated = row_count;
    if v_updated <> 0 then
      raise exception 'SECURITY FAILURE: a plain member issued an invoice';
    end if;
    raise notice 'Expected member issue denial: RLS filtered update (0 rows)';
  exception when insufficient_privilege then
    raise notice 'Expected member issue denial: %',SQLERRM;
  end;
  select status into v_status from public.production_invoices
   where id='22000000-0000-4000-8000-000000000001';
  if v_status is distinct from 'draft' then
    raise exception 'SECURITY FAILURE: member changed invoice status to %',v_status;
  end if;
end $;

-- 4. The owner issues it. The database stamps the issuer and the time.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.production_invoices set status='issued'
 where id='22000000-0000-4000-8000-000000000001';

do $$
declare v public.production_invoices%rowtype;
begin
  select * into v from public.production_invoices
   where id='22000000-0000-4000-8000-000000000001';
  if v.status <> 'issued' then
    raise exception 'FAILURE: the invoice did not move to issued (got %)',v.status;
  end if;
  if v.issued_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: the issuer was not stamped from the caller';
  end if;
  if v.issued_at is null then
    raise exception 'FAILURE: the issue time was not stamped';
  end if;
end $$;

-- 5. Issued money and scope evidence are immutable, and it cannot be re-issued.
do $$
begin
  begin
    update public.production_invoices set total=1
     where id='22000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: an issued invoice total was rewritten';
  exception when check_violation then
    raise notice 'Expected issued-total immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_invoices set line_items='[]'::jsonb
     where id='22000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: issued invoice lines were rewritten';
  exception when check_violation then
    raise notice 'Expected issued-lines immutability rejection: %',SQLERRM;
  end;

  begin
    update public.production_invoices set status='issued'
     where id='22000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: an issued invoice was re-issued';
  exception when check_violation then
    raise notice 'Expected re-issue rejection: %',SQLERRM;
  end;

  begin
    update public.production_invoices set status='draft'
     where id='22000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: an issued invoice moved back to draft';
  exception when check_violation then
    raise notice 'Expected issued-to-draft rejection: %',SQLERRM;
  end;
end $$;

-- 6. The owner voids it. A void invoice is terminal and immutable.
update public.production_invoices
   set status='void', void_reason='Duplicate draft'
 where id='22000000-0000-4000-8000-000000000001';

do $$
declare v public.production_invoices%rowtype;
begin
  select * into v from public.production_invoices
   where id='22000000-0000-4000-8000-000000000001';
  if v.status <> 'void' then
    raise exception 'FAILURE: the invoice did not move to void (got %)',v.status;
  end if;
  if v.voided_by <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: the voider was not stamped from the caller';
  end if;
  if v.voided_at is null then
    raise exception 'FAILURE: the void time was not stamped';
  end if;
  if v.void_reason <> 'Duplicate draft' then
    raise exception 'FAILURE: the void reason was not stored';
  end if;
end $$;

do $$
begin
  begin
    update public.production_invoices set void_reason='rewritten'
     where id='22000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: a void invoice was edited';
  exception when check_violation then
    raise notice 'Expected void immutability rejection: %',SQLERRM;
  end;
end $$;

-- 7. No caller deletes an invoice. RLS deletes zero rows; the trigger refuses
--    even for a caller that bypasses RLS.
delete from public.production_invoices
 where id='22000000-0000-4000-8000-000000000001';
do $$
begin
  if not exists (select 1 from public.production_invoices
                  where id='22000000-0000-4000-8000-000000000001') then
    raise exception 'SECURITY FAILURE: an invoice was deleted';
  end if;
end $$;

reset role;
do $$
begin
  begin
    delete from public.production_invoices
     where id='22000000-0000-4000-8000-000000000001';
    raise exception 'SECURITY FAILURE: the invoice trigger allowed a delete';
  exception when check_violation then
    raise notice 'Expected invoice delete trigger: %',SQLERRM;
  end;
end $$;

-- 8. A cancelled job cannot be invoiced.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.estimates
  (id,workspace_id,lead_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at)
values
  ('e3000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1a000000-0000-4000-8000-000000000001','approved','v1',200,0,200,
   '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());
insert into public.estimate_line_items
  (id,estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot)
values
  ('13000000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000002',
   'SHN-30','Architectural shingles','material','square',1,200,200,'{"source":"price_book"}');
insert into public.estimate_acceptances
  (id,workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
  ('ac300000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'e3000000-0000-4000-8000-000000000002','Pat Customer','phone',
   '11111111-1111-4111-8111-111111111111');
insert into public.production_jobs
  (id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('1d000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CANCELLED-JOB',
   '1a000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002',
   'ac300000-0000-4000-8000-000000000002','Fake','Fake','ready',1,'2000-01-01 00:00:00+00',
   'forged','[]',1,'11111111-1111-4111-8111-111111111111');
update public.production_jobs set status='cancelled'
 where id='1d000000-0000-4000-8000-000000000002';

do $$
begin
  begin
    insert into public.production_invoices(workspace_id,job_id,acceptance_id,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1d000000-0000-4000-8000-000000000002',
       'ac300000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: a cancelled job was invoiced';
  exception when check_violation then
    raise notice 'Expected cancelled-job invoice rejection: %',SQLERRM;
  end;
end $$;

-- 9. A scope that does not reconcile with the accepted total is refused.
insert into public.estimates
  (id,workspace_id,lead_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at)
values
  ('e3000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1a000000-0000-4000-8000-000000000001','approved','v1',450,50,500,
   '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());
insert into public.estimate_line_items
  (id,estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot)
values
  ('13000000-0000-4000-8000-000000000004','e3000000-0000-4000-8000-000000000003',
   'SHN-30','Architectural shingles','material','square',1,400,400,'{"source":"price_book"}');
insert into public.estimate_acceptances
  (id,workspace_id,estimate_id,accepted_by_name,acceptance_method,recorded_by)
values
  ('ac300000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'e3000000-0000-4000-8000-000000000003','Pat Customer','phone',
   '11111111-1111-4111-8111-111111111111');
insert into public.production_jobs
  (id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,
   customer_name,property_address,status,accepted_total,accepted_at,
   estimate_formula_version,approved_scope,scope_item_count,created_by)
values
  ('1d000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MISMATCH-JOB',
   '1a000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000003',
   'ac300000-0000-4000-8000-000000000003','Fake','Fake','ready',1,'2000-01-01 00:00:00+00',
   'forged','[]',1,'11111111-1111-4111-8111-111111111111');

do $$
begin
  begin
    insert into public.production_invoices(workspace_id,job_id,acceptance_id,created_by)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1d000000-0000-4000-8000-000000000003',
       'ac300000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: an unreconciled scope was invoiced';
  exception when check_violation then
    raise notice 'Expected scope reconciliation rejection: %',SQLERRM;
  end;
end $$;

-- 10. Another workspace cannot read or create either record.
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.production_invoices;
  if v_count <> 0 then
    raise exception 'SECURITY FAILURE: outsider saw % invoices',v_count;
  end if;

  begin
    insert into public.production_invoices(workspace_id,job_id,acceptance_id,created_by)
    values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1d000000-0000-4000-8000-000000000001',
       'ac300000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333');
    raise exception 'SECURITY FAILURE: another workspace created an invoice';
  exception when check_violation then
    raise notice 'Expected cross-workspace invoice rejection: %',SQLERRM;
  end;
end $$;

-- 11. A member reads the invoice, and the handoff snapshot is untouched.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare v public.production_jobs%rowtype;
declare v_invoice public.production_invoices%rowtype;
begin
  select * into v_invoice from public.production_invoices
   where id='22000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'FAILURE: a member could not read the invoice';
  end if;
  if v_invoice.total <> 575 then
    raise exception 'FAILURE: the invoice total changed (got %)',v_invoice.total;
  end if;

  select * into v from public.production_jobs
   where id='1d000000-0000-4000-8000-000000000001';
  if v.accepted_total <> 500 or v.scope_item_count <> 2 then
    raise exception 'FAILURE: invoicing changed the handoff amount or scope';
  end if;
  if v.customer_name <> 'Pat Customer' or v.property_address <> '1 Main St' then
    raise exception 'FAILURE: invoicing changed the customer snapshot';
  end if;
end $$;

select 'PASS: owner-only invoice creation, database-computed scope/tax/change-order/deposit totals, approved-only change orders, draft start, member issue denial, stamped issuer and void, issued immutability, no re-issue, no reopen, void terminal, no delete, cancelled-job refusal, scope reconciliation refusal, cross-workspace denial, handoff snapshot unchanged' as result;
