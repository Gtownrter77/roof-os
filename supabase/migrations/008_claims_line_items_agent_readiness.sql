-- ROOF/OS claims estimating and agent readiness foundation
-- This intentionally does not copy proprietary Xactimate codes, descriptions, or prices.

create table if not exists public.insurance_line_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  internal_code text not null,
  trade text not null check (trade in ('roofing','siding','gutters','windows','doors','interior','mitigation','general')),
  description text not null,
  unit text not null,
  coverage_type text not null default 'repair' check (coverage_type in ('repair','replacement','remove_replace','allowance','mitigation')),
  labor_component boolean not null default true,
  material_component boolean not null default true,
  equipment_component boolean not null default false,
  taxable boolean not null default true,
  depreciation_eligible boolean not null default true,
  price_book_item_id uuid references public.price_book_items(id) on delete restrict,
  source_type text not null check (source_type in ('licensed_provider','verified_supplier','manual_owner_entry')),
  source_reference text,
  market text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_at),
  unique (workspace_id, internal_code, market, effective_at)
);

create table if not exists public.agent_worker_heartbeats (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_key text not null check (agent_key in ('intake_router','scheduler','inspection_quality','office_copilot')),
  worker_id text not null,
  worker_version text not null,
  status text not null check (status in ('starting','healthy','degraded','stopped')),
  capabilities jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  primary key (workspace_id, agent_key)
);

create index if not exists insurance_line_items_workspace_market_idx
  on public.insurance_line_items (workspace_id, market, effective_at desc);
create index if not exists agent_worker_heartbeats_seen_idx
  on public.agent_worker_heartbeats (workspace_id, last_seen_at desc);

alter table public.insurance_line_items enable row level security;
alter table public.agent_worker_heartbeats enable row level security;

create policy insurance_line_items_select
  on public.insurance_line_items for select
  using (public.is_workspace_member(workspace_id));
create policy insurance_line_items_write
  on public.insurance_line_items for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id) and auth.uid() = created_by);

create policy agent_worker_heartbeats_select
  on public.agent_worker_heartbeats for select
  using (public.is_workspace_admin(workspace_id));

-- No client insert/update policy is intentional. Trusted workers must authenticate
-- separately and update heartbeats with a narrowly scoped server-side credential.
