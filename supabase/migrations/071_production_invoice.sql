-- Production invoice created from the approved scope (additive)
--
-- An invoice is a snapshot of what the customer already accepted: the handoff
-- scope lines, the recorded tax, the approved change-order deltas, and the
-- deposit already received. The database computes every amount. The browser
-- cannot supply a total, a tax, a line item, or a deposit credit.
--
-- Lifecycle is draft -> issued, or draft/issued -> void. An issued invoice is
-- immutable. This migration adds no payment state; payment and failed/reversed
-- outcomes are a separate record.

create table if not exists public.production_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete restrict,
  acceptance_id uuid not null references public.estimate_acceptances(id) on delete restrict,
  invoice_number text not null default 'PENDING'
    check (char_length(invoice_number) between 1 and 40),
  status text not null default 'draft' check (status in ('draft','issued','void')),
  currency text not null default 'usd' check (currency = 'usd'),
  source_accepted_total numeric(12,2) not null default 0 check (source_accepted_total > 0),
  source_tax numeric(12,2) not null default 0 check (source_tax >= 0),
  scope_lines_total numeric(12,2) not null default 0 check (scope_lines_total >= 0),
  change_order_total numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0 check (subtotal > 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total > 0),
  deposit_credit numeric(12,2) not null default 0 check (deposit_credit >= 0),
  balance_due numeric(12,2) not null default 0 check (balance_due >= 0),
  scope_item_count integer not null default 0 check (scope_item_count > 0),
  line_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(line_items) = 'array'),
  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text not null default '' check (char_length(void_reason) <= 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_invoices_number_workspace unique (workspace_id, invoice_number),
  check (
    (status = 'draft' and issued_at is null and issued_by is null
      and voided_at is null and voided_by is null)
    or (status = 'issued' and issued_at is not null and issued_by is not null
      and voided_at is null and voided_by is null)
    or (status = 'void' and voided_at is not null and voided_by is not null)
  ),
  check (deposit_credit <= total),
  check (balance_due = total - deposit_credit)
);

create index if not exists production_invoices_job_idx
  on public.production_invoices (job_id, created_at desc);
create index if not exists production_invoices_workspace_idx
  on public.production_invoices (workspace_id, created_at desc);

-- At most one live invoice per job. A voided invoice stays as history and does
-- not block a replacement.
create unique index if not exists production_invoices_one_live_per_job
  on public.production_invoices (job_id) where status <> 'void';

alter table public.production_invoices enable row level security;

drop policy if exists production_invoices_select on public.production_invoices;
create policy production_invoices_select on public.production_invoices
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_invoices_insert on public.production_invoices;
create policy production_invoices_insert on public.production_invoices
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists production_invoices_update on public.production_invoices;
create policy production_invoices_update on public.production_invoices
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- No delete policy. An invoice is voided, never erased.

create or replace function public.enforce_production_invoice()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
  v_acceptance public.estimate_acceptances%rowtype;
  v_scope_lines jsonb := '[]'::jsonb;
  v_change_lines jsonb := '[]'::jsonb;
  v_scope_subtotal numeric(12,2) := 0;
  v_scope_tax numeric(12,2) := 0;
  v_scope_count integer := 0;
  v_change_total numeric(12,2) := 0;
  v_deposit numeric(12,2) := 0;
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_credit numeric(12,2);
begin
  if tg_op = 'DELETE' then
    raise exception 'A production invoice cannot be deleted; void it instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'void' then
      raise exception 'A void invoice is immutable'
        using errcode = '23514';
    end if;

    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.acceptance_id is distinct from old.acceptance_id
       or new.invoice_number is distinct from old.invoice_number
       or new.currency is distinct from old.currency
       or new.source_accepted_total is distinct from old.source_accepted_total
       or new.source_tax is distinct from old.source_tax
       or new.scope_lines_total is distinct from old.scope_lines_total
       or new.change_order_total is distinct from old.change_order_total
       or new.subtotal is distinct from old.subtotal
       or new.tax is distinct from old.tax
       or new.total is distinct from old.total
       or new.deposit_credit is distinct from old.deposit_credit
       or new.balance_due is distinct from old.balance_due
       or new.scope_item_count is distinct from old.scope_item_count
       or new.line_items is distinct from old.line_items
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Invoice money, scope evidence, and identity are immutable'
        using errcode = '23514';
    end if;

    if new.status is not distinct from old.status then
      raise exception 'Only an invoice status move is allowed'
        using errcode = '23514';
    end if;

    if not public.is_workspace_admin(new.workspace_id) then
      raise exception 'Workspace owner or administrator access is required to move an invoice'
        using errcode = '42501';
    end if;

    if new.status = 'issued' then
      if old.status <> 'draft' then
        raise exception 'Only a draft invoice can be issued'
          using errcode = '23514';
      end if;
      new.issued_by := auth.uid();
      new.issued_at := now();
      new.voided_by := null;
      new.voided_at := null;
      new.void_reason := '';
    elsif new.status = 'void' then
      new.voided_by := auth.uid();
      new.voided_at := now();
    else
      raise exception 'Invalid invoice status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;

    new.updated_at := now();
    return new;
  end if;

  -- INSERT: the database reads the approved scope and computes every amount.
  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A production invoice must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The invoice must belong to the job workspace'
      using errcode = '23514';
  end if;

  if v_job.status = 'cancelled' then
    raise exception 'A cancelled production job cannot be invoiced'
      using errcode = '23514';
  end if;

  if not public.is_workspace_admin(new.workspace_id) then
    raise exception 'Workspace owner or administrator access is required to create an invoice'
      using errcode = '42501';
  end if;

  select * into v_acceptance from public.estimate_acceptances
   where id = v_job.acceptance_id;
  if not found then
    raise exception 'A production invoice must reference the recorded acceptance'
      using errcode = '23503';
  end if;

  if v_acceptance.workspace_id is distinct from v_job.workspace_id
     or v_acceptance.estimate_id is distinct from v_job.estimate_id then
    raise exception 'The acceptance must belong to the invoiced job'
      using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'kind', 'scope',
             'line_item_id', e->>'line_item_id',
             'item_code', e->>'item_code',
             'description', e->>'description',
             'category', e->>'category',
             'unit', e->>'unit',
             'quantity', (e->>'quantity')::numeric,
             'unit_cost', (e->>'unit_cost')::numeric,
             'line_total', (e->>'line_total')::numeric
           ) order by e->>'line_item_id'
         ), '[]'::jsonb),
         coalesce(sum((e->>'line_total')::numeric)
           filter (where e->>'category' is distinct from 'tax'), 0),
         coalesce(sum((e->>'line_total')::numeric)
           filter (where e->>'category' = 'tax'), 0),
         count(*)
    into v_scope_lines, v_scope_subtotal, v_scope_tax, v_scope_count
  from jsonb_array_elements(v_job.approved_scope) e;

  if v_scope_count = 0 then
    raise exception 'An invoice needs at least one approved scope line'
      using errcode = '23514';
  end if;

  if v_scope_tax > 0 and abs(v_scope_tax - v_acceptance.accepted_tax) > 0.005 then
    raise exception 'The approved tax line items do not match the recorded acceptance tax'
      using errcode = '23514';
  end if;

  if abs(v_scope_subtotal + v_acceptance.accepted_tax - v_job.accepted_total) > 0.005 then
    raise exception 'The approved scope does not reconcile with the accepted total and tax'
      using errcode = '23514';
  end if;

  select coalesce(sum(amount_delta), 0),
         coalesce(jsonb_agg(
           jsonb_build_object(
             'kind', 'change_order',
             'change_order_id', id,
             'description', description,
             'line_total', amount_delta
           ) order by created_at, id
         ), '[]'::jsonb)
    into v_change_total, v_change_lines
  from public.production_job_change_orders
  where job_id = v_job.id
    and workspace_id = v_job.workspace_id
    and status = 'approved';

  select coalesce(sum(
           case
             when event_type = 'received' then amount
             when event_type = 'refunded' then -amount
             else 0
           end), 0)
    into v_deposit
  from public.estimate_deposit_events
  where acceptance_id = v_acceptance.id
    and workspace_id = v_job.workspace_id;

  v_tax := v_acceptance.accepted_tax;
  v_subtotal := v_scope_subtotal + v_change_total;
  v_total := v_subtotal + v_tax;
  v_credit := least(greatest(v_deposit, 0), v_total);

  if v_subtotal <= 0 then
    raise exception 'An invoice needs a positive subtotal'
      using errcode = '23514';
  end if;

  -- Server-owned identity and evidence.
  new.invoice_number := 'INV-' || upper(substr(replace(new.id::text, '-', ''), 1, 12));
  new.status := 'draft';
  new.currency := 'usd';
  new.acceptance_id := v_acceptance.id;
  new.source_accepted_total := v_job.accepted_total;
  new.source_tax := v_tax;
  new.scope_lines_total := v_scope_subtotal;
  new.change_order_total := v_change_total;
  new.subtotal := v_subtotal;
  new.tax := v_tax;
  new.total := v_total;
  new.deposit_credit := v_credit;
  new.balance_due := v_total - v_credit;
  new.scope_item_count := v_scope_count;
  new.line_items := v_scope_lines || v_change_lines;
  new.issued_at := null;
  new.issued_by := null;
  new.voided_at := null;
  new.voided_by := null;
  new.void_reason := '';
  new.created_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_invoice on public.production_invoices;
create trigger enforce_production_invoice
  before insert or update or delete on public.production_invoices
  for each row execute function public.enforce_production_invoice();

revoke all on function public.enforce_production_invoice() from public, anon;
grant execute on function public.enforce_production_invoice() to authenticated;

comment on table public.production_invoices is
  'Invoice snapshot computed from the approved scope, recorded tax, approved change orders, and received deposit. No payment state.';
comment on column public.production_invoices.line_items is
  'Approved scope lines plus approved change-order lines. Computed by the database, never supplied by the browser.';
comment on column public.production_invoices.deposit_credit is
  'Received deposit minus refunds at invoice creation. Never supplied by the browser.';
comment on column public.production_invoices.issued_by is
  'Server-stamped owner or administrator. Never supplied by the browser.';
