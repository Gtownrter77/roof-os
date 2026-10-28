-- Payment state and failed/reversed outcomes (Day 25)
-- Adds payment tracking to production invoices without altering the
-- database-computed invoice snapshot from migration 071.
-- Payment outcomes are a separate record; invoice status remains draft/issued/void.

-- Create payment attempts table
create table if not exists public.production_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.production_invoices(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','reversed')),
  payment_method text check (payment_method in ('stripe','manual','ach','cash','other')),
  receipt_reference text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_reason text check (char_length(failure_reason) <= 500),
  created_by uuid not null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint production_invoice_payments_one_live_per_invoice unique (invoice_id) where status in ('succeeded','pending')
);

alter table public.production_invoice_payments enable row level security;

drop policy if exists production_invoice_payments_select on public.production_invoice_payments;
create policy production_invoice_payments_select on public.production_invoice_payments
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_invoice_payments_insert on public.production_invoice_payments;
create policy production_invoice_payments_insert on public.production_invoice_payments
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists production_invoice_payments_update on public.production_invoice_payments;
create policy production_invoice_payments_update on public.production_invoice_payments
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

comment on table public.production_invoice_payments is
  'Payment attempt records for production invoices. Linked by invoice_id, never alters invoice status or computed amounts. Failed/reversed records preserve audit trail.';

