-- Property-centered Roof Passport, warranty lifecycle, and readiness snapshots.

create table if not exists public.roof_passports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  property_address text not null,
  homeowner_name text,
  material_system text,
  manufacturer text,
  color text,
  install_date date,
  squares numeric(12,2),
  ventilation_notes text,
  status text not null default 'draft' check (status in ('draft','active','transferred','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  passport_id uuid references public.roof_passports(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  manufacturer text,
  product_line text,
  registration_status text not null default 'not_started' check (registration_status in ('not_started','packet_ready','submitted','registered','expired','claim_open')),
  registered_at date,
  expires_at date,
  transfer_allowed boolean not null default true,
  missing_items text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_readiness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  score integer not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  unique (lead_id)
);

alter table public.roof_passports enable row level security;
alter table public.warranties enable row level security;
alter table public.job_readiness enable row level security;

create policy roof_passports_select on public.roof_passports for select using (public.is_workspace_member(workspace_id));
create policy roof_passports_write on public.roof_passports for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy warranties_select on public.warranties for select using (public.is_workspace_member(workspace_id));
create policy warranties_write on public.warranties for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy job_readiness_select on public.job_readiness for select using (public.is_workspace_member(workspace_id));
create policy job_readiness_write on public.job_readiness for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
