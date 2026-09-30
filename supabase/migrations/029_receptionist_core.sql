create table if not exists public.receptionist_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound')),
  channel text not null check (channel in ('voice','sms','email')),
  provider text not null,
  provider_session_id text not null,
  caller_phone text,
  status text not null default 'active' check (status in ('active','completed','transferred','failed','opted_out')),
  outcome text,
  transcript text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_session_id)
);
create table if not exists public.receptionist_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid references public.receptionist_sessions(id) on delete set null,
  event_key text not null,
  event_type text not null,
  provider text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, event_key)
);
create table if not exists public.receptionist_consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  phone text,
  channel text not null check (channel in ('voice','sms','email')),
  state text not null check (state in ('granted','revoked','unknown')),
  source text not null,
  captured_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  invoice_number text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = lower(currency)),
  status text not null default 'draft' check (status in ('draft','issued','paid','void')),
  due_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, invoice_number)
);
alter table public.invoices enable row level security;
create policy invoices_select on public.invoices for select using (public.is_workspace_member(workspace_id));
create policy invoices_write on public.invoices for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create table if not exists public.receptionist_payment_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  provider text not null,
  provider_link_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = lower(currency)),
  status text not null default 'created' check (status in ('created','sent','paid','failed','expired','refunded','disputed')),
  url text not null,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (provider, provider_link_id)
);
create table if not exists public.receptionist_call_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  phone text not null,
  direction text not null check (direction in ('inbound','outbound')),
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'queued' check (status in ('queued','ringing','answered','voicemail','failed','opted_out','completed')),
  provider_call_id text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, lead_id, phone, direction, attempt_number)
);

alter table public.receptionist_sessions enable row level security;
alter table public.receptionist_events enable row level security;
alter table public.receptionist_consents enable row level security;
alter table public.receptionist_payment_links enable row level security;
alter table public.receptionist_call_attempts enable row level security;
create policy receptionist_sessions_select on public.receptionist_sessions for select using (public.is_workspace_member(workspace_id));
create policy receptionist_sessions_write on public.receptionist_sessions for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy receptionist_events_select on public.receptionist_events for select using (public.is_workspace_member(workspace_id));
create policy receptionist_events_write on public.receptionist_events for insert with check (public.is_workspace_admin(workspace_id));
create policy receptionist_consents_select on public.receptionist_consents for select using (public.is_workspace_member(workspace_id));
create policy receptionist_consents_write on public.receptionist_consents for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy receptionist_payment_links_select on public.receptionist_payment_links for select using (public.is_workspace_member(workspace_id));
create policy receptionist_payment_links_write on public.receptionist_payment_links for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy receptionist_call_attempts_select on public.receptionist_call_attempts for select using (public.is_workspace_member(workspace_id));
create policy receptionist_call_attempts_write on public.receptionist_call_attempts for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
